# Common OPN Python package Makefile.
#
# The most common invocations are
# `make dev`, `make download`, `make requirements`, and `make test`.

-include vars.mk
# vars.mk defines:
# - venv_dir
# - pypi_dir
# - pypi_clone_url
# - fix_requirements_path
# - transitive_requirements
# - is_local_package
# - source_indexes
# - all_requirements
# - cleanup_script

# Use "make requirements upgrade=1" to upgrade existing requirements.
upgrade=
local_index_url=file://$(shell cd ${pypi_dir} && pwd)/simple

ifneq ($(upgrade),)
	pip_compile_source_flags=--upgrade $(source_indexes)
else
	pip_compile_source_flags=--index-url "$(local_index_url)"
endif

ifneq ($(is_local_package),)
	setup_cfg=setup.cfg
	dev_extra=--extra dev
	include_local_package=-e .
	include_local_package_dev=-e .[dev]
else
	setup_cfg=
	dev_extra=
	include_local_package=
	include_local_package_dev=
endif

# Libraries needed for installing packages
packaging_core_libs=setuptools pip wheel

# Libraries needed for downloading packages from a private pypi
# Note: dbus-python is needed for keyring; keyring is needed for
# downloading packages from private indexes. dbus-python may require
# `sudo apt install libdbus-1-dev libglib2.0-dev`.
packaging_download_libs=keyring 'dbus-python<1.3'

# Libraries needed for selecting packages and creating indexes
packaging_select_libs=pip-tools pip2pi

default: dev

# Create the Python virtual environment for this package and its dependencies
$(venv_dir)/bin/python:
	python3 -m venv $(venv_dir)

$(pypi_dir)/simple/index.html:
	git clone $(pypi_clone_url) $(pypi_dir)

# Set up a development environment
dev: $(venv_dir)/bin/python $(pypi_dir)/simple/index.html
	$(venv_dir)/bin/python -m pip install -U \
		--index-url "$(local_index_url)" \
		$(packaging_core_libs) \
		$(packaging_download_libs)
	$(venv_dir)/bin/python -m pip install \
		--index-url "$(local_index_url)" \
		-r requirements-dev.txt $(include_local_package_dev)

# Install (in a non-development environment)
install: $(venv_dir)/bin/python $(pypi_dir)/simple/index.html
	$(venv_dir)/bin/python -m pip install -U \
		--index-url "$(local_index_url)" \
		$(packaging_core_libs)
	$(venv_dir)/bin/python -m pip install \
		--index-url "$(local_index_url)" \
		-r requirements.txt $(include_local_package)

# Run tests
test: $(venv_dir)/bin/python
	$(venv_dir)/bin/pytest -n 6 src

# Install the tools needed for pinning the requirements list.
# Use public versions because, in the case of a new package,
# the private index might not exist yet.
# ("make dev" or "make install" will correct the versions.)
$(venv_dir)/bin/pip-compile: $(venv_dir)/bin/python
	$(venv_dir)/bin/python -m pip install $(packaging_core_libs) $(packaging_download_libs) $(packaging_select_libs)

# Generate both lists of pinned requirements
requirements: requirements-dev.txt requirements.txt

# Generate the list of pinned requirements used in non-development environments
requirements.txt: requirements.in $(setup_cfg) $(venv_dir)/bin/pip-compile $(transitive_requirements)
	rm -f requirements-packaging-tmp.in
	touch requirements-packaging-tmp.in
	for pkg in $(packaging_core_libs); do \
		echo $${pkg} >> requirements-packaging-tmp.in; \
	done
	# Note: --allow-unsafe is recommended by pip-tools.
	$(venv_dir)/bin/pip-compile \
		$(pip_compile_source_flags) \
		--no-emit-index-url \
		--output-file requirements-tmp.txt \
		--allow-unsafe \
		requirements.in $(setup_cfg) \
		requirements-packaging-tmp.in
	if [ ! -z "$(fix_requirements_path)" ]; then \
		$(venv_dir)/bin/python "$(fix_requirements_path)" requirements-tmp.txt; fi
	rm requirements-packaging-tmp.in
	mv requirements-tmp.txt requirements.txt

# Generate the list of pinned requirements used in development
requirements-dev.txt: requirements-dev.in $(setup_cfg) $(venv_dir)/bin/pip-compile $(transitive_requirements)
	rm -f requirements-packaging-dev-tmp.in
	touch requirements-packaging-dev-tmp.in
	for pkg in $(packaging_core_libs) $(packaging_download_libs) $(packaging_select_libs); do \
		echo $${pkg} >> requirements-packaging-dev-tmp.in; \
	done
	# Note: --allow-unsafe is recommended by pip-tools.
	$(venv_dir)/bin/pip-compile \
		$(pip_compile_source_flags) \
		--no-emit-index-url \
		--output-file requirements-dev-tmp.txt \
		--allow-unsafe \
		$(dev_extra) \
		requirements-dev.in $(setup_cfg) \
		requirements-packaging-dev-tmp.in
	if [ ! -z "$(fix_requirements_path)" ]; then \
		$(venv_dir)/bin/python "$(fix_requirements_path)" requirements-dev-tmp.txt; fi
	rm requirements-packaging-dev-tmp.in
	mv requirements-dev-tmp.txt requirements-dev.txt

# Install the "pip2pi" tool, which downloads Python packages into a
# local directory
$(venv_dir)/bin/pip2pi: $(venv_dir)/bin/python
	$(venv_dir)/bin/python -m pip install pip2pi $(packaging_download_libs)

# Download the dependencies of this Python package into the pypi_dir
download: $(venv_dir)/bin/pip2pi
	mkdir -p $(pypi_dir)
	$(venv_dir)/bin/pip2pi $(pypi_dir) \
		-r requirements-dev.txt \
		$(source_indexes) \
		$(packaging_core_libs) \
		$(packaging_download_libs) \
		$(packaging_select_libs)
	$(cleanup_script)

# Download the dependencies of this Python package and all its siblings
# into the pypi_dir
download-all: $(venv_dir)/bin/pip2pi
	cat $(all_requirements) | egrep '^[a-zA-Z0-9]' | sort | uniq > requirements-dev-all.txt
	$(venv_dir)/bin/pip2pi $(pypi_dir) -r requirements-dev-all.txt \
		$(source_indexes) \
		$(packaging_core_libs) \
		$(packaging_download_libs) \
		$(packaging_select_libs)
	rm -f requirements-dev-all.txt
	$(cleanup_script)

# Prepare a few package-specific default artifacts.
# Use `make -f ../common/Makefile new-package` to start a new package.
new-package:
	if [ ! -e Makefile ] ; then ln -sfn ../common/Makefile; fi
	if [ ! -e vars.mk ] ; then ln -sfn ../common/vars.mk; fi
	if [ ! -e setup.py ] ; then ln -sfn ../common/setup.py; fi
	if [ ! -e pyproject.toml ]; then ln -s ../common/pyproject.toml; fi
	if [ ! -e MANIFEST.in ]; then cp ../common/MANIFEST.in.tmpl ./MANIFEST.in; fi
	if [ ! -e setup.cfg ]; then cp ../common/setup.cfg.tmpl ./setup.cfg; fi
	if [ ! -e requirements.in ]; then cp ../common/requirements.in.tmpl ./requirements.in; fi
	if [ ! -e requirements-dev.in ]; then cp ../common/requirements-dev.in.tmpl ./requirements-dev.in; fi
	mkdir -p .vscode
	if [ ! -e .vscode/settings.json ]; then ln -s ./common/vscode-settings.json .vscode/settings.json; fi
	mkdir -p src
	# Note: "pip-compile" generates ugly errors if the src directory doesn't contain any Python code.

# Run `black` and `isort` to format the Python code in this package.
fmt: $(venv_dir)/bin/python
	$(venv_dir)/bin/python -m black .
	$(venv_dir)/bin/python -m isort .

.PHONY: default dev install test requirements download download-all new-package fmt
