/* global test, expect */

import { binder } from './binder';
import { binder1 } from './binder';

test('binder() binds an attribute', () => {
  const obj = {
    myfunc() {
      return 'this is bound to ' + String(this);
    },
  };
  expect(binder(obj)('myfunc')()).toEqual('this is bound to [object Object]');
});


test('binder() maintains the identity of bound attributes', () => {
  const obj = {
    myfunc() {},
    myfunc2() {},
  };
  const b = binder(obj);
  expect(b('myfunc')).toBe(b('myfunc'));
  expect(b('myfunc2')).toBe(b('myfunc2'));
  expect(b('myfunc')).not.toBe(b('myfunc2'));

  // A new binder generates a new binding.
  expect(b('myfunc')).not.toBe(binder(obj)('myfunc'));
});


test('binder1() binds an attribute', () => {
  const obj = {
    myfunc(arg1) {
      return 'this is ' + String(this) + ' and arg1 is ' + arg1;
    },
  };
  const b = binder1(obj);
  expect(b('myfunc', 'myarg')()).toEqual(
    'this is [object Object] and arg1 is myarg');
});


test('binder1() maintains the identity of bound attributes', () => {
  const obj = {
    myfunc() {},
    myfunc2() {},
  };
  const b = binder1(obj);
  expect(b('myfunc', 'myarg')).toBe(b('myfunc', 'myarg'));
  expect(b('myfunc2', 'myarg')).toBe(b('myfunc2', 'myarg'));
  expect(b('myfunc', 'myarg')).not.toBe(b('myfunc2', 'myarg'));
  expect(b('myfunc', 'myarg')).not.toBe(b('myfunc', 'myarg2'));

  // A new binder generates a new binding.
  expect(b('myfunc', 'myarg')).not.toBe(binder(obj)('myfunc', 'myarg'));
});
