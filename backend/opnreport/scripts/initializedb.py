
from dotenv import load_dotenv
from opnreport.models import get_engine
from opnreport.models.db import Base
from pyramid.paster import setup_logging
import os
import sys


def usage(argv):
    cmd = os.path.basename(argv[0])
    print('usage: %s <config_uri> [var=value]\n'
          '(example: "%s development.ini")' % (cmd, cmd))
    sys.exit(1)


def main(argv=sys.argv):
    if len(argv) < 2:
        usage(argv)

    load_dotenv()

    config_uri = argv[1]
    setup_logging(config_uri)
    engine = get_engine()
    Base.metadata.create_all(engine)
