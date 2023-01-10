import os.path

from opnreco.models.site import API
from pyramid.response import Response
from pyramid.view import view_config


@view_config(name="download-statement-template", context=API)
def download_statement_template(context, request):
    name = "Statement-Template-V2.xlsx"
    fn = os.path.join(os.path.dirname(__file__), "template", name)
    f = open(fn, "rb")
    content = f.read()
    f.close()
    content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    headers = {
        "Content-Disposition": 'attachment; filename="%s"' % name,
        "Content-Type": content_type,
        "Content-Length": "%d" % len(content),
    }

    return Response(content, headers=headers)
