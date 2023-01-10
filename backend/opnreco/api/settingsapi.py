import pytz
from opnreco.models import perms
from opnreco.models.db import OwnerLog
from opnreco.models.site import API
from pyramid.httpexceptions import HTTPBadRequest
from pyramid.view import view_config

_tznames = None


def get_tznames():
    global _tznames
    if _tznames is None:
        _tznames = sorted(pytz.all_timezones, key=lambda x: (x.lower(), x))
    return _tznames


@view_config(name="settings", context=API, permission=perms.use_app, renderer="json")
def settings_api(request):
    """Return the current settings for the user."""
    owner = request.owner

    res = {
        "tzname": owner.tzname or "America/New_York",
        "tznames": get_tznames(),
    }

    return res


@view_config(name="set-tzname", context=API, permission=perms.use_app, renderer="json")
def set_tzname(request):
    tzname = request.json.get("tzname")
    if tzname not in pytz.all_timezones:
        raise HTTPBadRequest(
            json_body={
                "error": "unrecognized_time_zone",
            }
        )

    owner = request.owner
    owner.tzname = tzname
    request.dbsession.add(
        OwnerLog(
            owner_id=owner.id,
            personal_id=request.personal_id,
            event_type="tzname_change",
            remote_addr=request.remote_addr,
            user_agent=request.user_agent,
            content={
                "tzname": tzname,
            },
        )
    )

    return settings_api(request)
