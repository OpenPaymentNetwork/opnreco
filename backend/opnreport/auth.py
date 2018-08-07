
from opnreport.models.db import TokenCache
from pyramid.interfaces import IAuthenticationPolicy
from pyramid.security import Everyone
from sqlalchemy.dialects.postgresql import insert
from zope.interface import implementer
import datetime
import re


@implementer(IAuthenticationPolicy)
class OPNTokenAuthenticationPolicy(object):

    def _get_token(self, request):
        header = request.headers.get('Authorization')
        if header:
            match = re.match(r'Bearer\s+([^\s]+)', header, re.I)
            if match:
                return match.group(1)

        # Get the access token from POST parameters
        # (not from the query string, which is problematic for security).
        token = request.POST.get('access_token')
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
        dbsession = request.dbsession
        now = datetime.datetime.utcnow()
        row = (
            dbsession.query(TokenCache)
            .filter_by(access_token=token)
            .first())
        if row is not None:
            if now < row.expires:
                return row.profile_id
            info = self._get_profile(token)
            if info is not None:
                # This token hasn't actually expired yet.
                row.expires = now + datetime.timedelta(seconds=60)
                return row.profile_id
            else:
                # This token expired.
                token = None
                # Take an opportunity to clean up expired tokens for this
                # profile.
                (dbsession.query(TokenCache)
                 .filter_by(profile_id=row.profile_id)
                 .delete())
                return None

        info = self._get_profile(token)
        if info:

            # Insert into TokenCache; on conflict, don't bother.
            # (It's just a cache.)
            profile_id = info['id']
            stmt = insert(TokenCache.__table__).values(
                access_token=token,
                expires=now + datetime.timedelta(seconds=60),
                profile_id=profile_id,
            ).on_conflict_do_nothing()

            dbsession.execute(stmt)
            return profile_id

        return None

    def _get_profile(self, token):
        # Get the profile info from OPN.
        pass

    def unauthenticated_userid(self, request):
        # TODO
        return None

    def authenticated_userid(self, request):
        # TODO
        return None

    def effective_principals(self, request):
        res = [Everyone]
        # TODO
        return res

    def remember(self, request, principal, **kw):
        raise TypeError("Not supported")

    def forget(self, request):
        raise TypeError("Not supported")
