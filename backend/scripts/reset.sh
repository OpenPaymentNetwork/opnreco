#!/bin/sh -e

# add these lines to /etc/sudoers using 'visudo', replacing _user_ with
# your username:
# Cmnd_Alias MANAGE_OPNREPORT_DB = /usr/sbin/dropdb opnreport, /usr/bin/createdb -O [A-Za-z0-9_]+ opnreport
# _user_ ALL=(postgres) NOPASSWD: MANAGE_OPNREPORT_DB

here="$(pwd)"
cd /
sudo -u postgres dropdb opnreport || true
sudo -u postgres createdb -O "${USER}" opnreport
cd "${here}/.."
bin/initialize_opnreport_db development.ini#opnreport
