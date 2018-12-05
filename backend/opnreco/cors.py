
"""Handle cross-origin resource sharing (CORS) preflight requests. See:

https://developer.mozilla.org/en-US/docs/HTTP/Access_control_CORS
"""

_max_age_header = str(86400 * 365)


def tween_factory(handler, registry):
    def cors_tween(request):
        if request.method == 'OPTIONS':
            # Tell the browser that CORS is OK here, but the only special
            # headers we accept are Authorization and Content-Type.
            response = request.response
            response.headers['Access-Control-Allow-Origin'] = '*'
            response.headers['Access-Control-Allow-Methods'] = (
                'GET, POST, OPTIONS, HEAD, PUT, DELETE')
            response.headers['Access-Control-Allow-Headers'] = (
                'Authorization,Content-Type')
            response.headers['Access-Control-Max-Age'] = _max_age_header
        else:
            response = handler(request)
            if response is not None:
                response.headers['Access-Control-Allow-Origin'] = '*'

                if not response.headers.get('Cache-Control'):
                    # Add a default cache-control header.
                    response.headers['Cache-Control'] = 'no-store'

        return response

    return cors_tween


def includeme(config):
    config.add_tween('opnreco.cors.tween_factory')
