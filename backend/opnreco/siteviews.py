import gzip
import mimetypes
import os.path

from opnreco.models.site import Site, StaticFile
from pyramid.httpexceptions import HTTPNotFound
from pyramid.response import FileResponse, Response
from pyramid.view import notfound_view_config, view_config

_frontend_build = None


def get_frontend_build():
    """Get the directory where the frontend HTML/CSS/JS have been built."""
    global _frontend_build
    if not _frontend_build:
        _frontend_build = os.path.abspath(
            os.path.join(
                os.path.dirname(__file__),
                os.environ["opn_frontend_build"],
            )
        )
    return _frontend_build


@view_config(name="", context=Site)
def index_html(request):
    frontend_build = get_frontend_build()
    fn = os.path.join(frontend_build, "index.html")
    response = FileResponse(fn, request=request, content_type="text/html;charset=utf-8")
    response.cache_control = "no-store, no-cache"
    return response


@view_config(name="", context=StaticFile)
def static_file_view(context, request):
    """Get a top level static file like favicon.ico"""
    frontend_build = get_frontend_build()
    fn = os.path.join(frontend_build, context.__name__)
    return make_static_file_response(fn, request)


@view_config(name="static", context=Site)
def static_file_view(context, request):
    frontend_build = get_frontend_build()

    if request.subpath:
        subpath = [item for item in request.subpath if item not in ("..", ".", "")]
    else:
        subpath = ()

    fn = os.path.join(frontend_build, "static", *subpath)

    return make_static_file_response(fn, request, cache_control="public")


gzip_cache = {}  # {frontend file name: {mtime, size, gzipped_content}}


def make_static_file_response(fn, request, cache_control="no-store"):
    pos = fn.rfind(".")
    if pos >= 0:
        ext = fn[pos:]
    else:
        ext = ""

    if not os.path.exists(fn):
        raise HTTPNotFound()

    if ext not in (".jpg", ".png", ".gif") and "gzip" in request.headers.get(
        "Accept-Encoding", ""
    ):
        mtime = os.path.getmtime(fn)
        size = os.path.getsize(fn)
        gzipped = gzip_cache.get(fn)

        if gzipped:
            if mtime != gzipped["mtime"] or size != gzipped["size"]:
                gzipped = None

        if not gzipped:
            f = open(fn, "rb")
            content = f.read()
            f.close()
            gzipped = {
                "mtime": mtime,
                "size": size,
                "gzipped_content": gzip.compress(content),
            }
            gzip_cache[fn] = gzipped

        if gzipped:
            content_type, _ = mimetypes.guess_type(fn, strict=False)
            if content_type is None:
                content_type = "application/octet/stream"
            body = gzipped["gzipped_content"]
            return Response(
                body=body,
                conditional_response=True,
                content_type=content_type,
                content_encoding="gzip",
                last_modified=mtime,
                content_length=len(body),
                cache_control=cache_control,
            )

    response = FileResponse(fn, request=request)
    response.cache_control = cache_control
    return response


@notfound_view_config()
def notfound(request):
    """Render index.html for everything else.

    The frontend code will route appropriately.
    """
    if request.path.startswith("/api/"):
        # Return a response appropriate for API views.
        return HTTPNotFound(
            json_body={
                "error": "not_found",
                "error_description": "The resource could not be found.",
            }
        )

    frontend_build = get_frontend_build()
    fn = os.path.join(frontend_build, "index.html")
    f = open(fn, "rt")
    body_init = f.read()
    f.close()
    # Insert the base tag in index.html.
    pos = body_init.find("<head>")
    assert pos > 0
    pos += 6
    body = '%s<base href="/" />%s' % (body_init[:pos], body_init[pos:])
    return Response(
        conditional_response=True,
        content_type="text/html;charset=utf-8",
        charset="utf-8",
        body=body,
        cache_control="no-store, no-cache",
    )
