// Function-calling-convention converters. Ops are authored in the curried
// form directly; these bridge to/from the flat (data, ...args) form for the
// rare data-first call sites.

// makeCurry: flat (data, ...args) => result → curried (...args) => (data) => result.
export function makeCurry<A extends unknown[], D, R>(
  fn: (data: D, ...args: A) => R,
): (...args: A) => (data: D) => R {
  return (...args: A) =>
    (data: D) =>
      fn(data, ...args);
}

// Type-level curried → flat, preserving data type params from the source
// (`(data: X<D>) => R`). Limitation: the source's rest param must be
// unconstrained — a constrained one (compose's `...fns: Fns & ComposeChain<Fns>`)
// infers `A` as `never` and can't typecheck without a cast.
type Flatten<F> = F extends (...args: infer A) => (data: infer Data) => infer R
  ? (data: Data, ...args: A) => R
  : never;

// makeFlat: curried → flat; the runtime backing for pipe.
export function makeFlat<F extends (...args: any) => any>(fn: F): Flatten<F> {
  return ((data: any, ...args: any[]) => fn(...args)(data)) as Flatten<F>;
}
