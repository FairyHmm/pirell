// Function-calling-convention converters. Ops are authored in the curried
// form directly; these bridge to/from the flat (data, ...args) form for the
// rare data-first call sites. Both are shape-agnostic — they only flip the
// calling convention, deriving the other form from the input's own
// structure.

// makeCurry: flat (data, ...args) => result → curried (...args) => (data) => result.
export function makeCurry<A extends unknown[], D, R>(
  fn: (data: D, ...args: A) => R,
): (...args: A) => (data: D) => R {
  return (...args: A) =>
    (data: D) =>
      fn(data, ...args);
}

// Type-level curried → flat, deriving the other form from the input's own
// structure. Preserves data type params from the source (`(data: X<D>) => R`).
// A curried fn whose data param is itself generic (e.g. a gated
// `compose`'s `<D>(data: Gate<Fns,D>) => R`) does not round-trip here — the
// flattened form must keep its gate, which makeFlat (shape-agnostic by
// design) does not carry. gating/compose/pipe declare that explicitly at
// their own site (compose.ts), not here.
type Flatten<F> = F extends (...args: infer A) => (data: infer Data) => infer R
  ? (data: Data, ...args: A) => R
  : never;

// makeFlat: curried → flat; general form converter.
export function makeFlat<F extends (...args: any) => any>(
  fn: F,
): Flatten<F> {
  return ((data: any, ...args: any[]) => fn(...args)(data)) as Flatten<F>;
}
