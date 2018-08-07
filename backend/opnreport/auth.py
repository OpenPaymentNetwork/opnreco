
from pyramid.interfaces import IAuthenticationPolicy
from pyramid.security import Authenticated
from pyramid.security import Everyone
from zope.interface import implementer
import datetime
import logging
import os
import re
import requests

log = logging.getLogger(__name__)


@implementer(IAuthenticationPolicy)
class OPNTokenAuthenticationPolicy(object):
    """Authentication policy based on OPN access tokens.

    Maintains a cache of valid access tokens.
    """

    def __init__(self):
        self.opn_api_url = os.environ['opn_api_url']
        self.token_cache = {}  # {access_token: {id, valid_until, info}}
        self.cache_duration = datetime.timedelta(seconds=60)

    def _get_token(self, request):
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

    def _get_profile_id_for_token(self, request, token):
        if not token:
            return None

        now = datetime.datetime.utcnow()
        entry = self.token_cache.get(token)
        if entry is not None:
            if now < entry['valid_until']:
                return entry['id']
            info = self._request_profile_info(request, token)
            if info is not None:
                # This token hasn't actually expired yet.
                profile_id = info['id']
                self.token_cache[token] = {
                    'id': profile_id,
                    'valid_until': now + self.cache_duration,
                    'info': info,
                }
                return profile_id
            else:
                # This token expired.
                # Take an opportunity to clean up the token cache.
                to_delete = []
                for token, info in self.token_cache.items():
                    if now >= info['valid_until']:
                        to_delete.append(token)
                for token in to_delete:
                    self.token_cache.pop(token, None)
                return None

        info = self._request_profile_info(request, token)
        if info:
            profile_id = info['id']
            self.token_cache[token] = {
                'id': profile_id,
                'valid_until': now + self.cache_duration,
                'info': info,
            }
            return profile_id

        return None

    def _request_profile_info(self, request, token):
        """Get the profile info from OPN."""
        url = '%s/wallet/info' % self.opn_api_url
        r = requests.get(
            url,
            headers={'Authorization': 'Bearer %s' % token},
            timeout=30)
        try:
            r.raise_for_status()
        except Exception as e:
            try:
                error_json = r.json()
            except Exception:
                error_json = None
            log.warning(
                "Can't get profile info for access token: %s, %s"
                % (e, error_json))
            return None

        info = r.json()['profile']

        # opn_profiles = request.environ.get('opn_profiles')
        # if opn_profiles is None:
        #     opn_profiles = {}
        #     request.environ['opn_profiles'] = opn_profiles
        # opn_profiles[info['id']] = info

        return info

    def authenticated_userid(self, request):
        token = self._get_token(request)
        profile_id = self._get_profile_id_for_token(request, token)
        return profile_id

    unauthenticated_userid = authenticated_userid

    def effective_principals(self, request):
        res = [Everyone]
        token = self._get_token(request)
        profile_id = self._get_profile_id_for_token(request, token)
        if profile_id:
            res.append(Authenticated)
            res.append(profile_id)
        return res

    def remember(self, request, principal, **kw):
        raise TypeError("Not supported")

    def forget(self, request):
        raise TypeError("Not supported")
