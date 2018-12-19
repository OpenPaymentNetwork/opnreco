
from opnreco.models import perms
from opnreco.models.db import Period
from pyramid.decorator import reify
from pyramid.security import Allow
from pyramid.security import Authenticated
from pyramid.security import DENY_ALL
from weakref import ref
import re

webpack_file_re = re.compile(
    r'^((app|vendor|[0-9]+)\.[0-9a-f]{8,99}\.(js|css))'
    r'|([0-9a-f]{8,99}\.(png|jpg))'
    r'|favicon\.ico|humans\.txt|robots\.txt$')


class Site:
    __parent__ = None
    __name__ = None

    def __init__(self, request):
        self.dbsession = request.dbsession
        self.request_ref = ref(request)

    __acl__ = (
        (Allow, Authenticated, perms.use_app),
        DENY_ALL,
    )

    def __getitem__(self, name):
        if name == 'api':
            return self.api
        elif webpack_file_re.match(name):
            return WebpackFile(self, name)
        raise KeyError(name)

    @reify
    def api(self):
        return API(self)


class WebpackFile:
    def __init__(self, site, name):
        self.__parent__ = site
        self.__name__ = name


class API:

    def __init__(self, parent):
        self.__parent__ = parent
        self.__name__ = 'api'
        self.request_ref = parent.request_ref

    def __getitem__(self, name):
        if name == 'period':
            return self.periods
        raise KeyError(name)

    @reify
    def periods(self):
        return PeriodCollection(self, 'period')


class PeriodCollection:
    def __init__(self, parent, name):
        self.__parent__ = parent
        self.__name__ = name
        self.request_ref = parent.request_ref
        self.items = {}  # {period_id: PeriodResource}

    def __getitem__(self, name):
        try:
            period_id = int(name)
        except ValueError:
            raise KeyError(name)

        period = self.items.get(period_id)
        if period is not None:
            return period

        dbsession = self.request_ref().dbsession
        period = (
            dbsession.query(Period)
            .filter(Period.id == period_id)
            .first()
        )
        if period is None:
            raise KeyError(name)

        pr = PeriodResource(self, str(period.id), period)
        self.items[period.id] = pr
        return pr


class PeriodResource:
    def __init__(self, parent, name, period):
        self.__parent__ = parent
        self.__name__ = name
        self.period = period

    @reify
    def __acl__(self):
        period = self.period
        if period.closed:
            return [
                (Allow, self.period.owner_id, (
                    perms.view_period,
                    perms.reopen_period,
                )),
                DENY_ALL,
            ]
        else:
            return [
                (Allow, self.period.owner_id, (
                    perms.view_period,
                    perms.edit_period,
                )),
                DENY_ALL,
            ]
