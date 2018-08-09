#!/bin/sh -e

# To use this script, first add these lines to /etc/sudoers
# using 'visudo', replacing _user_ with your username:
#
# Cmnd_Alias MANAGE_OPNREPORT_DB = /usr/sbin/dropdb opnreport(test)?, /usr/bin/createdb -O [A-Za-z0-9_]+ opnreport(test)?
# _user_ ALL=(postgres) NOPASSWD: MANAGE_OPNREPORT_DB

cd "$(dirname $0)"
here="$(pwd)"
cd /
sudo -u postgres dropdb opnreport || true
sudo -u postgres createdb -O "${USER}" opnreport
sudo -u postgres dropdb opnreporttest || true
sudo -u postgres createdb -O "${USER}" opnreporttest
cd "${here}/.."
bin/initialize_opnreport_db development.ini#opnreport
