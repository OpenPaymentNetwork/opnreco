
from opnreco.models import perms
from opnreco.models.db import File
from opnreco.models.db import Period
from pyramid.decorator import reify
from pyramid.security import Allow
from pyramid.security import Authenticated
from pyramid.security import DENY_ALL
from weakref import ref
import re

static_file_re = re.compile(
    r'^[a-zA-Z0-9\-.]+\.(json|js|ico|html|txt)$')


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
        elif static_file_re.match(name):
            return StaticFile(self, name)
        raise KeyError(name)

    @reify
    def api(self):
        return API(self)


class StaticFile:
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
        elif name == 'file':
            return self.files
        raise KeyError(name)

    @reify
    def periods(self):
        return PeriodCollection(self, 'period')

    @reify
    def files(self):
        return FileCollection(self, 'file')


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
            .join(File, Period.file_id == File.id)
            .filter(
                Period.id == resource_id,
                ~File.removed)
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
                (Allow, period.owner_id, (
                    perms.view_period,
                    perms.reopen_period,
                )),
                DENY_ALL,
            ]
        else:
            return [
                (Allow, period.owner_id, (
                    perms.view_period,
                    perms.edit_period,
                )),
                DENY_ALL,
            ]


class FileCollection(ResourceCollection):
    @reify
    def __acl__(self):
        return [
            (Allow, Authenticated, perms.use_app),
            (Allow, Authenticated, perms.create_file),
            DENY_ALL,
        ]

    def load(self, resource_id):
        dbsession = self.request_ref().dbsession
        row = (
            dbsession.query(File)
            .filter(File.id == resource_id, ~File.removed)
            .first()
        )
        if row is None:
            return None
        return FileResource(self, str(resource_id), row)


class FileResource:
    def __init__(self, parent, name, file):
        self.__parent__ = parent
        self.__name__ = name
        self.file = file

    @reify
    def __acl__(self):
        return [
            (Allow, self.file.owner_id, (
                perms.view_file,
                perms.edit_file,
            )),
            DENY_ALL,
        ]
