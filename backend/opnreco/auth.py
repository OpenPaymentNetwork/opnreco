import datetime
import logging
import os

import requests
from opnreco.models.db import OwnerLog
from opnreco.util import check_requests_response
from pyramid.authorization import Authenticated, Everyone
from pyramid.interfaces import IAuthenticationPolicy
from zope.interface import implementer

log = logging.getLogger(__name__)


@implementer(IAuthenticationPolicy)
class OPNTokenAuthenticationPolicy(object):
    """Authentication policy based on OPN access tokens.

    Maintains a cache of valid access tokens.
    """

    def __init__(self):
        self.opn_api_url = os.environ["opn_api_url"]
        self.token_cache = {}  # {access_token: {id, valid_until, wallet_info}}
        self.cache_duration = datetime.timedelta(seconds=60)

    def _get_profile_id_for_token(self, request, token):
        if not token:
            return None

        now = datetime.datetime.utcnow()
        entry = self.token_cache.get(token)
        if entry is not None:
            if now < entry["valid_until"]:
                request.wallet_info = entry["wallet_info"]
                return entry["id"]

            wallet_info = self._request_wallet_info(request, token)
            if wallet_info:
                # This token hasn't actually expired yet.
                profile_info = wallet_info["profile"]
                profile_id = profile_info["id"]
                self.token_cache[token] = {
                    "id": profile_id,
                    "valid_until": now + self.cache_duration,
                    "wallet_info": wallet_info,
                }
                request.wallet_info = wallet_info
                return profile_id

            else:
                # This token expired.
                # Take an opportunity to clean up the token cache.
                to_delete = []
                for token, entry1 in self.token_cache.items():
                    if now >= entry1["valid_until"]:
                        to_delete.append(token)
                for token in to_delete:
                    self.token_cache.pop(token, None)
                return None

        wallet_info = self._request_wallet_info(request, token)
        if wallet_info is not None:
            profile_info = wallet_info["profile"]
            profile_id = profile_info["id"]
            self.token_cache[token] = {
                "id": profile_id,
                "valid_until": now + self.cache_duration,
                "wallet_info": wallet_info,
            }
            request.wallet_info = wallet_info

            request.owner  # Add the Owner to the database
            request.dbsession.add(
                OwnerLog(
                    owner_id=profile_id,
                    personal_id=request.personal_id,
                    event_type="access",
                    remote_addr=request.remote_addr,
                    user_agent=request.user_agent,
                    content={"title": profile_info["title"]},
                )
            )

            return profile_id

        return None

    def _request_wallet_info(self, request, token):
        """Get the wallet info from OPN."""
        url = "%s/wallet/info" % self.opn_api_url
        r = requests.get(
            url, headers={"Authorization": "Bearer %s" % token}, timeout=30
        )
        if not check_requests_response(r, raise_exc=False):
            return None
        return r.json()

    def authenticated_userid(self, request):
        token = request.access_token
        profile_id = self._get_profile_id_for_token(request, token)
        return profile_id

    unauthenticated_userid = authenticated_userid

    def effective_principals(self, request):
        res = [Everyone]
        token = request.access_token
        profile_id = self._get_profile_id_for_token(request, token)
        if profile_id:
            res.append(Authenticated)
            res.append(profile_id)
        return res

    def remember(self, request, principal, **kw):
        raise TypeError("Not supported")

    def forget(self, request):
        raise TypeError("Not supported")
