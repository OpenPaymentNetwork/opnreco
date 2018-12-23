
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


resource_collection_attrs = {
    'period': 'periods',
}


class API:

    def __init__(self, parent):
        self.__parent__ = parent
        self.__name__ = 'api'
        self.request_ref = parent.request_ref

    def __getitem__(self, name):
        attr = resource_collection_attrs.get(name)
        if attr is not None:
            return getattr(self, attr)
        raise KeyError(name)

    @reify
    def periods(self):
        return PeriodCollection(self, 'period')


class ResourceCollection:
    def __init__(self, parent, name):
        self.__parent__ = parent
        self.__name__ = name
        self.request_ref = parent.request_ref
        self.resources = {}  # {resource_id: Resource}

    def __getitem__(self, name):
        try:
            resource_id = int(name)
        except ValueError:
            raise KeyError(name)

        resource = self.resources.get(resource_id)
        if resource is not None:
            return resource

        resource = self.load(resource_id)
        if resource is None:
            raise KeyError(name)

        self.resources[resource_id] = resource
        return resource


class PeriodCollection(ResourceCollection):
    def load(self, resource_id):
        dbsession = self.request_ref().dbsession
        row = (
            dbsession.query(Period)
            .filter(Period.id == resource_id)
            .first()
        )
        if row is None:
            return None
        return PeriodResource(self, str(resource_id), row)


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
