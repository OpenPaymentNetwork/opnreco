
from pyramid.view import view_config
from opnreport.models.site import API


@view_config(
    name='download',
    context=API,
    permission='use_app',
    renderer='json')
def download(request):
    return {'ok': 'synthetic'}
