
from decimal import Decimal
from decimal import InvalidOperation
from pyramid.httpexceptions import HTTPBadRequest
import re


null = None


def get_offset_limit(params):
    """Get the offset and limit from request params."""
    offset_str = params.get('offset', '')
    if not re.match(r'^[0-9]{1,20}$', offset_str):
        raise HTTPBadRequest(json_body={'error': 'offset_required'})
    offset = max(int(offset_str), 0)

    limit_str = params.get('limit', '')
    if limit_str == 'all':
        limit = None
    else:
        if not re.match(r'^[0-9]{1,20}$', limit_str):
            raise HTTPBadRequest(json_body={'error': 'limit_required'})
        limit = max(int(limit_str), 0)

    return offset, limit


amount_re = re.compile(r'[+-\u2212]?[0-9.,]{1,20}', re.U)


subunit0 = Decimal('0.')
subunit2 = Decimal('0.01')
subunit3 = Decimal('0.001')


currency_subunits = {
  'BHD': subunit3,
  'BYR': subunit0,
  'CLP': subunit0,
  'CVE': subunit0,
  'DJF': subunit0,
  'GNF': subunit0,
  'HUF': subunit0,
  'IDR': subunit0,
  'IQD': subunit3,
  'IRR': subunit0,
  'ISK': subunit0,
  'JOD': subunit3,
  'JPY': subunit0,
  'KHR': subunit0,
  'KMF': subunit0,
  'KRW': subunit0,
  'KWD': subunit3,
  'LBP': subunit0,
  'LYD': subunit3,
  'MGA': subunit0,
  'MRO': subunit0,
  'OMR': subunit3,
  'PYG': subunit0,
  'RWF': subunit0,
  'TND': subunit3,
  'UGX': subunit0,
  'VND': subunit0,
  'VUV': subunit0,
  'XAF': subunit0,
  'XOF': subunit0,
  'XPF': subunit0,
}


def parse_amount(amount_input, currency):
    match = amount_re.search(amount_input)
    if match is None:
        return None
    amount_input = match.group(0).replace('\u2212', '-').replace(',', '')
    try:
        return ParsedAmount(amount_input, currency)
    except InvalidOperation:
        return None


class ParsedAmount(Decimal):
    def __new__(cls, amount_input, currency):
        subunit = currency_subunits.get(currency, subunit2)
        value = Decimal(amount_input).quantize(subunit)
        self = Decimal.__new__(cls, value)
        self.amount_input = amount_input
        if '-' in amount_input:
            self.sign = -1
        elif '+' in amount_input:
            self.sign = 1
        else:
            # Unspecified.
            self.sign = 0
        return self
