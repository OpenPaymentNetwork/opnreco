
from dotenv import load_dotenv
from opnreport.auth import OPNTokenAuthenticationPolicy
from opnreport.models.db import Profile
from opnreport.models.db import ProfileLog
from opnreport.models.site import Site
from opnreport.render import CustomJSONRenderer
from opnreport.util import check_requests_response
from pyramid.authorization import ACLAuthorizationPolicy
from pyramid.config import Configurator
import datetime
import os
import re
import requests


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


def profile(request):
    if not request.authenticated_userid:
        return None

    api_url = os.environ['opn_api_url']

    dbsession = request.dbsession
    profile = (
        dbsession.query(Profile)
        .filter_by(id=request.authenticated_userid)
        .first())
    if profile is None:
        url = '%s/me' % api_url
        r = requests.get(
            url,
            headers={'Authorization': 'Bearer %s' % request.access_token})
        check_requests_response(r)
        profile_info = r.json()
        profile = Profile(
            id=profile_info['id'],
            title=profile_info['title'],
            last_download=datetime.datetime(1970, 1, 1))
        dbsession.add(profile)

        dbsession.add(ProfileLog(
            profile_id=profile.id,
            event_type='created',
            content={
                'title': profile.title,
                'remote_addr': request.remote_addr,
            }))

    return profile


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
    config.add_request_method(profile, name='profile', reify=True)
    config.add_renderer('json', CustomJSONRenderer)

    config.include('pyramid_retry')
    config.include('pyramid_tm')
    config.include('opnreport.models')
    config.scan('opnreport.views')

    # config.add_translation_dirs('opnreport:locale/')
    config.add_translation_dirs('colander:locale/')
    return config.make_wsgi_app()
