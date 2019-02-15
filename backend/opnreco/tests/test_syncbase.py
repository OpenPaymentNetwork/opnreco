
from decimal import Decimal
import unittest

zero = Decimal()


class Test_find_internal_movements(unittest.TestCase):

    def _call(self, *args, **kw):
        from ..syncbase import find_internal_movements
        return find_internal_movements(*args, **kw)

    def _make_movements(self, spec):
        res = []

        class DummyMovement:
            wallet_delta = zero
            vault_delta = zero
            amount_index = 0

            def __repr__(self):
                return (
                    '<DummyMovement id=%s wallet_delta=%s vault_delta=%s>' % (
                        self.id, self.wallet_delta, self.vault_delta))

            def __eq__(self, other):
                # This makes it easy to test movement sequences.
                if isinstance(other, Decimal) and other == self.vault_delta:
                    return True
                if isinstance(other, DummyMovement):
                    return vars(other) == vars(self)
                return False

        for index, item in enumerate(spec):
            m = DummyMovement()
            m.id = 101 + index
            m.number = 1 + index
            m.peer_id = 'c'
            m.loop_id = '0'
            m.currency = 'USD'
            m.action = 'testaction'

            if isinstance(item, dict):
                delta = item.pop('delta')
                vars(m).update(item)
            else:
                delta = item
            m.vault_delta = Decimal(delta)

            res.append(m)

        return res

    def test_unbalanced_1(self):
        movements = self._make_movements(['4.1'])
        iseqs = self._call(movements, {})
        self.assertEqual([], iseqs)

    def test_unbalanced_2(self):
        movements = self._make_movements(['4.1', '5'])
        iseqs = self._call(movements, {})
        self.assertEqual([], iseqs)

    def test_unbalanced_3(self):
        movements = self._make_movements(['4.1', '-5', '0.9'])
        iseqs = self._call(movements, {})
        self.assertEqual([], iseqs)

    def test_simple_hill(self):
        movements = self._make_movements(['4.1', '0.9', -5, 2])
        iseqs = self._call(movements, {})
        self.assertEqual([
            [Decimal('4.1'), Decimal('0.9'), Decimal('-5.0')],
        ], iseqs)

    def test_simple_valley(self):
        movements = self._make_movements(['-4.1', '-0.9', 5, 2])
        iseqs = self._call(movements, {})
        self.assertEqual([
            [Decimal('-4.1'), Decimal('-0.9'), Decimal('5.0')],
        ], iseqs)

    def test_hill_after_move(self):
        movements = self._make_movements([2, '4.1', '0.9', -5])
        iseqs = self._call(movements, {})
        self.assertEqual([
            [Decimal('4.1'), Decimal('0.9'), Decimal('-5.0')],
        ], iseqs)

    def test_valley_and_hill_with_nothing_in_between(self):
        movements = self._make_movements(['-4.1', '-0.9', 5, 3, -3, 1])
        iseqs = self._call(movements, {})
        self.assertEqual([
            [Decimal('-4.1'), Decimal('-0.9'), Decimal('5.0')],
            [Decimal('3'), Decimal('-3')],
        ], iseqs)

    def test_hill_valley_hill(self):
        movements = self._make_movements([
            1, 3, -3, '-4.1', '-0.9', 5, 7, -6, -1])
        iseqs = self._call(movements, {})
        self.assertEqual([
            [Decimal('3'), Decimal('-3')],
            [Decimal('-4.1'), Decimal('-0.9'), Decimal('5.0')],
            [Decimal('7'), Decimal('-6'), Decimal('-1')],
        ], iseqs)

    def test_valley_hill_valley(self):
        movements = self._make_movements([
            -1, -3, 3, '4.1', '0.9', -5, -7, 6, 1])
        iseqs = self._call(movements, {})
        self.assertEqual([
            [Decimal('-3'), Decimal('3')],
            [Decimal('4.1'), Decimal('0.9'), Decimal('-5.0')],
            [Decimal('-7'), Decimal('6'), Decimal('1')],
        ], iseqs)

    def test_valley_and_hill_with_move_in_between(self):
        movements = self._make_movements(['-4.1', '-0.9', 5, 2, 3, -3, 1])
        iseqs = self._call(movements, {})
        self.assertEqual([
            [Decimal('-4.1'), Decimal('-0.9'), Decimal('5.0')],
            [Decimal('3'), Decimal('-3')],
        ], iseqs)

    def test_hill_and_valley_with_move_in_between(self):
        movements = self._make_movements(['4.1', '0.9', -5, -2, -3, 3, -1])
        iseqs = self._call(movements, {})
        self.assertEqual([
            [Decimal('4.1'), Decimal('0.9'), Decimal('-5.0')],
            [Decimal('-3'), Decimal('3')],
        ], iseqs)

    def test_hill_with_non_internal_action(self):
        movements = self._make_movements([
            '4.1',
            {'delta': '0.9', 'action': 'move'},
            -5])
        iseqs = self._call(movements, {})
        self.assertEqual([], iseqs)

    def test_valley_with_non_internal_action(self):
        movements = self._make_movements([
            '-4.1',
            {'delta': '-0.9', 'action': 'move'},
            5])
        iseqs = self._call(movements, {})
        self.assertEqual([], iseqs)

    def test_hill_with_manual_reco_followed_by_hill(self):
        movements = self._make_movements([
            '4.1', '0.9', 5,
            7, -3, -4])
        iseqs = self._call(movements, {2})
        self.assertEqual([
            [Decimal('7'), Decimal('-3'), Decimal('-4')],
        ], iseqs)

    def test_valley_with_manual_reco_followed_by_valley(self):
        movements = self._make_movements([
            '-4.1', '-0.9', -5,
            -7, 3, 4])
        iseqs = self._call(movements, {2})
        self.assertEqual([
            [Decimal('-7'), Decimal('3'), Decimal('4')],
        ], iseqs)

    def test_equal_hill_and_hill(self):
        movements = self._make_movements(['0.25', '-0.25', '0.25', '-0.25'])
        iseqs = self._call(movements, {})
        self.assertEqual([
            [Decimal('0.25'), Decimal('-0.25')],
            [Decimal('0.25'), Decimal('-0.25')],
        ], iseqs)

    def test_reorder_migrated_movements_when_needed(self):
        movements = self._make_movements([
            {'action': '', 'ts': '2017-12-29T15:55:26.05', 'delta': '0'},
            {'action': '', 'ts': '2017-12-29T15:55:26.54', 'delta': '99.75'},
            {'action': '', 'ts': '2017-12-29T15:55:26.54', 'delta': '-100.00'},
            {'action': '', 'ts': '2017-12-29T15:55:26.60', 'delta': '0.25'},
        ])
        iseqs = self._call(movements, {})
        self.assertEqual([
            [Decimal('-100.00'), Decimal('99.75'), Decimal('0.25')],
        ], iseqs)

    def test_reorder_migrated_movements_when_not_needed(self):
        movements = self._make_movements([
            {'action': '', 'ts': '2017-12-29T15:55:26.05', 'delta': '0'},
            {'action': '', 'ts': '2017-12-29T15:55:26.54', 'delta': '-100.00'},
            {'action': '', 'ts': '2017-12-29T15:55:26.54', 'delta': '99.75'},
            {'action': '', 'ts': '2017-12-29T15:55:26.60', 'delta': '0.25'},
        ])
        iseqs = self._call(movements, {})
        self.assertEqual([
            [Decimal('-100.00'), Decimal('99.75'), Decimal('0.25')],
        ], iseqs)

    def test_reorder_not_possible_because_no_movement_after(self):
        movements = self._make_movements([
            {'action': '', 'ts': '2017-12-29T15:55:26.05', 'delta': '0'},
            {'action': '', 'ts': '2017-12-29T15:55:26.54', 'delta': '-100.00'},
            {'action': '', 'ts': '2017-12-29T15:55:26.54', 'delta': '99.75'},
        ])
        iseqs = self._call(movements, {})
        self.assertEqual([], iseqs)

    def test_reorder_restores_hill(self):
        movements = self._make_movements([
            {'action': '', 'ts': '2017-12-29T15:55:26.05', 'delta': '0'},
            {'action': '', 'ts': '2017-12-29T15:55:26.54', 'delta': '-99.75'},
            {'action': '', 'ts': '2017-12-29T15:55:26.54', 'delta': '100.00'},
            {'action': '', 'ts': '2017-12-29T15:55:26.60', 'delta': '-0.25'},
        ])
        iseqs = self._call(movements, {})
        self.assertEqual([
            [Decimal('100.00'), Decimal('-99.75'), Decimal('-0.25')],
        ], iseqs)

    def test_reorder_as_hill_based_on_movement_before(self):
        movements = self._make_movements([
            {'action': '', 'ts': '2017-12-29T15:55:26.05', 'delta': '0.25'},
            {'action': '', 'ts': '2017-12-29T15:55:26.54', 'delta': '-100.00'},
            {'action': '', 'ts': '2017-12-29T15:55:26.54', 'delta': '99.75'},
        ])
        iseqs = self._call(movements, {})
        self.assertEqual([
            [Decimal('0.25'), Decimal('99.75'), Decimal('-100.00')],
        ], iseqs)

    def test_reorder_as_valley_based_on_movement_before(self):
        movements = self._make_movements([
            {'action': '', 'ts': '2017-12-29T15:55:26.05', 'delta': '-0.25'},
            {'action': '', 'ts': '2017-12-29T15:55:26.54', 'delta': '100.00'},
            {'action': '', 'ts': '2017-12-29T15:55:26.54', 'delta': '-99.75'},
        ])
        iseqs = self._call(movements, {})
        self.assertEqual([
            [Decimal('-0.25'), Decimal('-99.75'), Decimal('100.00')],
        ], iseqs)
