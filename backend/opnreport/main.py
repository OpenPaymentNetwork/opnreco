
from dotenv import load_dotenv
from opnreport.auth import OPNTokenAuthenticationPolicy
from opnreport.models.db import Owner
from opnreport.models.db import OwnerLog
from opnreport.models.site import Site
from opnreport.render import CustomJSONRenderer
from opnreport.util import check_requests_response
from pyramid.authorization import ACLAuthorizationPolicy
from pyramid.config import Configurator
import datetime
import os
import re
import requests
import sqlalchemy.dialects.postgresql


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


def wallet_info(request):
    """Get the info about the owner profile from OPN."""
    access_token = request.access_token
    if not access_token:
        return None

    api_url = os.environ['opn_api_url']
    url = '%s/wallet/info' % api_url
    r = requests.get(
        url,
        headers={'Authorization': 'Bearer %s' % access_token})
    check_requests_response(r)
    return r.json()


def owner(request):
    """Get the Owner row for the authenticated profile"""
    authenticated_userid = request.authenticated_userid
    if not authenticated_userid:
        return None

    dbsession = request.dbsession
    owner = (
        dbsession.query(Owner)
        .filter_by(id=authenticated_userid)
        .first())
    if owner is None:
        owner_info = request.wallet_info['profile']

        # Insert without creating a conflict with concurrent requests.
        values = {
            'id': owner_info['id'],
            'title': owner_info['title'],
            'username': owner_info['username'] or '',
        }
        stmt = (
            sqlalchemy.dialects.postgresql.insert(
                Owner.__table__, bind=dbsession).values(**values)
            .on_conflict_do_nothing())
        dbsession.execute(stmt)

        # Now the owner should exist.
        owner = (
            dbsession.query(Owner)
            .filter_by(id=authenticated_userid)
            .one())

        dbsession.add(OwnerLog(
            owner_id=owner.id,
            event_type='created',
            remote_addr=request.remote_addr,
            user_agent=request.user_agent,
            memo={'title': owner.title},
        ))

    else:
        now = datetime.datetime.utcnow()
        if now - owner.last_update >= datetime.timedelta(seconds=60 * 15):
            # Update the owner's title and username.
            wallet_info = request.wallet_info
            profile_info = wallet_info['profile']
            if owner.title != profile_info['title']:
                owner.title = profile_info['title']
            username = profile_info['username'] or ''
            if owner.username != username:
                owner.username = username
            owner.last_update = now

    return owner


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
    config.add_request_method(wallet_info, name='wallet_info', reify=True)
    config.add_request_method(owner, name='owner', reify=True)
    config.add_renderer('json', CustomJSONRenderer)

    config.include('opnreport.cors')
    config.include('pyramid_retry')
    config.include('pyramid_tm')
    config.include('opnreport.models.dbmeta')
    config.scan('opnreport.views', ignore='opnreport.views.tests')

    # config.add_translation_dirs('opnreport:locale/')
    config.add_translation_dirs('colander:locale/')
    return config.make_wsgi_app()
