#!/bin/sh -e

# 'sudo' access is required to use this script.

cd "$(dirname $0)"
here="$(pwd)"
cd /
sudo -u postgres dropdb opnreco || true
sudo -u postgres createdb -O "${USER}" opnreco
sudo -u postgres dropdb opnrecotest || true
sudo -u postgres createdb -O "${USER}" opnrecotest
cd "${here}/.."
bin/initialize_opnreco_db development.ini#opnreco
