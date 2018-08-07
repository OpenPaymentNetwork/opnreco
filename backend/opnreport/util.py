
import logging

log = logging.getLogger(__name__)


def check_requests_response(r, raise_exc=True):
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
