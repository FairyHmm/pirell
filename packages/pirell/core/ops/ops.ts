// General-purpose form converters. They know nothing about shapes or `Op` —
// they only convert function calling convention. Ops are authored directly
// against the `Op<In,Out,Args>` type (which is always curried); these two
// helpers handle the rare cases where a flat fn must become curried, or a
// curried fn must be handed to a flat (data-first) caller.

// makeCurry: flat (data, ...args) => result → curried (...args) => (data) => result.
export function makeCurry<A extends unknown[], D, R>(
  fn: (data: D, ...args: A) => R,
): (...args: A) => (data: D) => R {
  return (...args: A) =>
    (data: D) =>
      fn(data, ...args);
}

// makeFlat: curried (...args) => (data) => result → flat (data, ...args) => result.
// e.g. pipe = makeFlat(compose) — the data-first view of the curried core.
export function makeFlat<A extends unknown[], D, R>(
  fn: (...args: A) => (data: D) => R,
): (data: D, ...args: A) => R {
  return (data: D, ...args: A) => fn(...args)(data);
}
