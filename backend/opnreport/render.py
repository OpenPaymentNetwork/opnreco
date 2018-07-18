
from colander import null
from decimal import Decimal
import datetime
import json


class CustomJSONRenderer(object):
    """JSON renderer that handles Decimal, datetime, and colander.null."""

    def __init__(self, info):
        pass

    def __call__(self, value, system):
        """ Call the renderer implementation with the value
        and the system value passed in as arguments and return
        the result (a string or unicode object).  The value is
        the return value of a view.  The system value is a
        dictionary containing available system values
        (e.g. view, context, and request). """
        request = system.get('request')
        indent = '  '
        separators = (', ', ': ')

        res = json.dumps(
            value,
            separators=separators,
            indent=indent,
            sort_keys=True,
            default=get_json_default)

        if request is not None:
            response = request.response
            ct = response.content_type
            if ct == response.default_content_type:
                response.content_type = 'application/json; charset=UTF-8'

        return res


def get_json_default(obj):
    """Try to serialize an object without an implicit serialization."""
    if obj is null:
        return None

    if isinstance(obj, Decimal):
        return str(obj)

    if isinstance(obj, datetime.datetime):
        return datetime_to_json(obj)

    if isinstance(obj, datetime.date):
        return obj.isoformat()

    raise TypeError("Unable to serialize {!r} to JSON.".format(obj))


def datetime_to_json(obj):
    if obj is None:
        return None

    if obj.tzinfo is None:
        # Assume UTC.
        return '%sZ' % obj.isoformat()
    else:
        return obj.isoformat()
