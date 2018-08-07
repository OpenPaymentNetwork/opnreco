
from opnreport.models.site import API
from opnreport.util import check_requests_response
from pyramid.view import view_config
import os
import requests
import logging

log = logging.getLogger(__name__)


@view_config(
    name='download',
    context=API,
    permission='use_app',
    renderer='json')
def download(request):
    api_url = os.environ['opn_api_url']
    url = '%s/wallet/history_download' % api_url
    r = requests.post(
        url,
        data={'min_activity_ts': '2018-08-01T00:00:00'},
        headers={'Authorization': 'Bearer %s' % request.access_token})
    check_requests_response(r)
    return r.json()
