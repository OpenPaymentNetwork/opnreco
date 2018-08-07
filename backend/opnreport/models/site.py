
from pyramid.decorator import reify
from pyramid.security import Allow
from pyramid.security import DENY_ALL
from pyramid.security import Authenticated
from weakref import ref
import re

webpack_file_re = re.compile(
    r'^((app|vendor|[0-9]+)\.[0-9a-f]{8,99}\.(js|css))'
    r'|([0-9a-f]{8,99}\.(png|jpg))'
    r'|favicon\.ico|humans\.txt|robots\.txt$')


class Site(object):
    __parent__ = None
    __name__ = None

    def __init__(self, request):
        self.dbsession = request.dbsession
        self.request_ref = ref(request)

    __acl__ = (
        (Allow, Authenticated, 'use_app'),
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


class WebpackFile(object):
    def __init__(self, site, name):
        self.__parent__ = site
        self.__name__ = name


class API(object):

    def __init__(self, site):
        self.__parent__ = site
        self.__name__ = 'api'
        self.request_ref = site.request_ref
