import unittest
from decimal import Decimal


class Test_parse_amount(unittest.TestCase):
    def _call(self, *args, **kw):
        from ..param import parse_amount

        return parse_amount(*args, **kw)

    def test_basic(self):
        obj = self._call("2.12", "USD")
        self.assertEqual(Decimal("2.12"), obj)
        self.assertEqual(0, obj.sign)
        self.assertEqual("2.12", obj.amount_input)

    def test_quantize(self):
        obj = self._call("2.126", "USD")
        self.assertEqual(Decimal("2.13"), obj)
        self.assertEqual(0, obj.sign)
        self.assertEqual("2.126", obj.amount_input)

    def test_negative(self):
        obj = self._call("-2.12", "USD")
        self.assertEqual(Decimal("-2.12"), obj)
        self.assertEqual(Decimal("2.12"), abs(obj))
        self.assertEqual(-1, obj.sign)
        self.assertEqual("-2.12", obj.amount_input)

    def test_explicit_positive(self):
        obj = self._call("+2.12", "USD")
        self.assertEqual(Decimal("2.12"), obj)
        self.assertEqual(1, obj.sign)
        self.assertEqual("+2.12", obj.amount_input)

    def test_minus_sign(self):
        obj = self._call("\u22124", "USD")
        self.assertEqual(Decimal("-4"), obj)
        self.assertEqual(-1, obj.sign)
        self.assertEqual("-4", obj.amount_input)

    def test_with_noise(self):
        obj = self._call("a fine -5 here", "USD")
        self.assertEqual(Decimal("-5"), obj)
        self.assertEqual(-1, obj.sign)
        self.assertEqual("-5", obj.amount_input)

    def test_with_no_value(self):
        obj = self._call("a fine value", "USD")
        self.assertEqual(None, obj)
