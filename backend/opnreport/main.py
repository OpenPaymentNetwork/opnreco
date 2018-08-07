
from dotenv import load_dotenv
from opnreport.models.site import Site
from opnreport.render import CustomJSONRenderer
from opnreport.auth import OPNTokenAuthenticationPolicy
from pyramid.authorization import ACLAuthorizationPolicy
from pyramid.config import Configurator
import re


def access_token(request):
    """Read the access token from the request, or None"""
    header = request.headers.get('Authorization')
    if header:
        match = re.match(r'Bearer\s+([^\s]+)', header, re.I)
        if match:
            return match.group(1)

    # Get the access token from parameters.
    token = request.params.get('access_token')
    if token:
        return token

    if getattr(request, 'content_type', None) == 'application/json':
        try:
            json_body = request.json_body
        except ValueError:
            json_body = None
        if isinstance(json_body, dict):
            # Get the access token from the JSON request body.
            token = json_body.get('access_token')
            if token and isinstance(token, str):
                return token

    return None


def main(global_config, **settings):
    """This function returns a Pyramid WSGI application."""
    load_dotenv()

    def make_root(request):
        return request.site

    config = Configurator(
        root_factory=make_root,
        settings=settings,
        authentication_policy=OPNTokenAuthenticationPolicy(),
        authorization_policy=ACLAuthorizationPolicy(),
    )

    config.add_request_method(Site, name='site', reify=True)
    config.add_request_method(access_token, name='access_token', reify=True)
    config.add_renderer('json', CustomJSONRenderer)

    config.include('pyramid_retry')
    config.include('pyramid_tm')
    config.include('opnreport.models')
    config.scan('opnreport.views')

    # config.add_translation_dirs('opnreport:locale/')
    config.add_translation_dirs('colander:locale/')
    return config.make_wsgi_app()
