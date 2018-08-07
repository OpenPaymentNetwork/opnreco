
from dotenv import load_dotenv
from opnreport.models.site import Site
from opnreport.render import CustomJSONRenderer
from opnreport.auth import OPNTokenAuthenticationPolicy
from pyramid.authorization import ACLAuthorizationPolicy
from pyramid.config import Configurator


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
    config.add_renderer('json', CustomJSONRenderer)

    config.include('pyramid_retry')
    config.include('pyramid_tm')
    config.include('opnreport.models')
    config.scan('opnreport.views')

    # config.add_translation_dirs('opnreport:locale/')
    config.add_translation_dirs('colander:locale/')
    return config.make_wsgi_app()
