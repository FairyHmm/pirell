// Calling-convention converters (curried ↔ flat). Shape-agnostic.

/**
 * Converts flat `(data, ...args) => result` to curried
 * `(...args) => (data) => result`. Shape-agnostic: flips the calling
 * convention from the input's own structure, nothing else.
 */
export function makeCurry<A extends unknown[], D, R>(
  fn: (data: D, ...args: A) => R,
): (...args: A) => (data: D) => R {
  return (...args: A) =>
    (data: D) =>
      fn(data, ...args);
}

// Curried → flat at the type level (a data param closed over outer
// generics can't round-trip; the entry claim is authored at the call
// site, not here).
type Flatten<F> = F extends (...args: infer A) => (data: infer Data) => infer R
  ? (data: Data, ...args: A) => R
  : never;

/**
 * Converts curried `(...args) => (data) => result` to flat
 * `(data, ...args) => result`. Shape-agnostic, like
 * {@linkcode makeCurry} in reverse.
 */
export function makeFlat<F extends (...args: any) => any>(fn: F): Flatten<F> {
  return ((data: any, ...args: any[]) => fn(...args)(data)) as Flatten<F>;
}
