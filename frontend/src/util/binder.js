
/**
 * Return a function that binds object methods.
 * It keeps a record of previously bound attributes so they have the same
 * identity on every access.
 */
export function binder(obj) {
  const map = {};  // {name: bound method}
  return (unbound) => {
    const methodName = unbound.name;
    var v = map[methodName];
    if (v === undefined) {
      v = unbound.bind(obj);
      map[methodName] = v;
    }
    return v;
  };
}

/**
 * Return a function that binds object methods along with a single argument.
 * The argument must be usable as a Map key.
 */
export function binder1(obj) {
  const map0 = {};  // {name: Map of {arg0 -> bound method}}

  return (unbound, arg0) => {
    const methodName = unbound.name;
    var map1 = map0[methodName];
    if (map1 === undefined) {
      map1 = new Map();
      map0[methodName] = map1;
    }

    var func = map1.get(arg0);
    if (func === undefined) {
      func = unbound.bind(obj, arg0);
      map1.set(arg0, func);
    }

    return func;
  };
}
