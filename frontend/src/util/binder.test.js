/* global test, expect */

import { binder } from './binder';
import { binder1 } from './binder';

test('binder() binds a method', () => {
  const obj = {
    myfunc() {
      return 'this is bound to ' + String(this);
    },
  };
  expect(binder(obj)(obj.myfunc)()).toEqual('this is bound to [object Object]');
});


test('binder() maintains the identity of bound methods', () => {
  const obj = {
    myfunc() {},
    myfunc2() {},
  };
  const b = binder(obj);
  expect(b(obj.myfunc)).toBe(b(obj.myfunc));
  expect(b(obj.myfunc2)).toBe(b(obj.myfunc2));
  expect(b(obj.myfunc)).not.toBe(b(obj.myfunc2));

  // A new binder generates a new binding.
  expect(b(obj.myfunc)).not.toBe(binder(obj)(obj.myfunc));
});


test('binder1() binds a method', () => {
  const obj = {
    myfunc(arg1) {
      return 'this is ' + String(this) + ' and arg1 is ' + arg1;
    },
  };
  const b = binder1(obj);
  expect(b(obj.myfunc, 'myarg')()).toEqual(
    'this is [object Object] and arg1 is myarg');
});


test('binder1() maintains the identity of bound methods', () => {
  const obj = {
    myfunc() {},
    myfunc2() {},
  };
  const b = binder1(obj);
  expect(b(obj.myfunc, 'myarg')).toBe(b(obj.myfunc, 'myarg'));
  expect(b(obj.myfunc2, 'myarg')).toBe(b(obj.myfunc2, 'myarg'));
  expect(b(obj.myfunc, 'myarg')).not.toBe(b(obj.myfunc2, 'myarg'));
  expect(b(obj.myfunc, 'myarg')).not.toBe(b(obj.myfunc, 'myarg2'));

  // A new binder generates a new binding.
  expect(b(obj.myfunc, 'myarg')).not.toBe(binder(obj)(obj.myfunc, 'myarg'));
});
