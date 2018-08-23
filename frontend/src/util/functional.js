
// compose(f, g)(value) === f(g(value)).
//
// See: https://medium.com/javascript-scene/reduce-composing-software-fe22f0c39a1d

export const compose = (...fns) => x => fns.reduceRight((v, f) => f(v), x);
