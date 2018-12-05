
from pyramid.httpexceptions import HTTPUnauthorized
import datetime
import logging
import re

log = logging.getLogger(__name__)


def check_requests_response(r, raise_exc=True):
    if r.status_code == 401:
        # Propagate Unauthorized errors.
        kw = {}
        try:
            kw['json_body'] = r.json()
        except Exception:
            pass
        response = HTTPUnauthorized(**kw)
        raise response

    try:
        r.raise_for_status()
    except Exception as e:
        try:
            error_json = r.json()
        except Exception:
            error_json = None
        log.warning(
            "Request to %s failed: %s, %s" % (r.url, e, error_json))
        if raise_exc:
            raise
        else:
            return False
    else:
        return True


datetime_re = re.compile(
    r'(\d{4})-(\d\d)-(\d\d)'             # date
    r'[T ](\d\d):(\d\d):(\d\d)(\.\d+)?'  # time
    r'(Z|[\+\-]\d\d:?\d\d)?$')           # time zone


def to_datetime(input_str, allow_none=False):
    """Convert a datetime.isoformat() string back to a datetime.

    Accepts a time zone, but converts the datetime to UTC.  (Python's
    support for time zone awareness would add unnecessary complexity to
    most code that uses this function.)
    """
    if allow_none and input_str is None:
        return None
    mo = datetime_re.match(input_str)
    if mo is None:
        raise ValueError("Not a valid datetime: %s" % repr(input_str))
    y, m, d, H, M, S, SS, tz = mo.groups()
    if SS:
        if len(SS) < 7:
            # Pad to milliseconds.
            SS = (SS + '000000')[:7]
        ms = int(SS[1:7])
    else:
        ms = 0
    res = datetime.datetime(int(y), int(m), int(d), int(H), int(M), int(S), ms)
    if tz and tz not in ('Z', '+00:00', '-00:00'):
        # Convert to UTC.
        hours = int(tz[:3])
        minutes = int(tz[4:])
        sign = -1 if hours < 0 else 1
        offset = hours * 3600 + sign * minutes * 60
        res -= datetime.timedelta(seconds=offset)
    return res


def dashed(n):
    """Return an identifier with dashes embedded for readability."""
    s = str(n)
    pos = 0
    res = []
    s_len = len(s)
    while pos < s_len:
        res.append(s[pos:pos + 4])
        pos += 4
    return '-'.join(res)
