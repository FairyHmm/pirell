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
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- accepts any curried fn; a unknown[] constraint would reject compose's overload and concrete factories by variance
export function makeFlat<F extends (...args: any) => any>(fn: F): Flatten<F> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call -- Flatten can't walk composed signatures (see pipe's doc), and fn's constraint return is any to allow the double call; the cast is the stamp of that single unchecked step
  return ((data: unknown, ...args: unknown[]) => fn(...args)(data)) as Flatten<F>;
}
