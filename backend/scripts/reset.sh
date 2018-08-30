#!/bin/sh -e

# 'sudo' access is required to use this script.

cd "$(dirname $0)"
here="$(pwd)"
cd /
sudo -u postgres dropdb opnreport || true
sudo -u postgres createdb -O "${USER}" opnreport
sudo -u postgres dropdb opnreporttest || true
sudo -u postgres createdb -O "${USER}" opnreporttest
cd "${here}/.."
bin/initialize_opnreport_db development.ini#opnreport
