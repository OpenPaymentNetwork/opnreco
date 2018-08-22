
/* Return a function that binds object attributes.
 * It keeps a record of previously bound attributes so they have the same
 * identity on every access.
 */
export function binder(obj) {
  const bound = {};  // {name: bound method}
  return (name) => {
    var v = bound[name];
    if (v === undefined) {
      v = obj[name].bind(obj);
      bound[name] = v;
    }
    return v;
  };
}

/* Return a function that binds object attributes along with a single argument.
 */
export function binder1(obj) {
  const bound = {};  // {name: Map of {arg0 -> bound method}}

  return (name, arg0) => {
    var map = bound[name];
    if (map === undefined) {
      map = new Map();
      bound[name] = map;
    }

    var func = map.get(arg0);
    if (func === undefined) {
      func = obj[name].bind(obj, arg0);
      map.set(arg0, func);
    }

    return func;
  };
}
