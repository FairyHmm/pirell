import type { Op, Raw, Shape } from "./types.js";
import type { Check, MatchesIn, ShapeOf } from "./match.js";

// Function-composition utility. Also usable with pirell Ops: a chain may be a
// mix of Ops and plain unary functions, shape-checked at compile time.

// Shape a value carries at the current position: from a Raw<Shape> phantom
// directly, otherwise derived structurally from the value's static type.
type ShapeOfCur<Cur> =
  Cur extends Raw<infer S extends Shape> ? S : ShapeOf<Cur> & Shape;

// Apply fn F to the current value type Cur; yields F's output value type, or
// never if a shape/link mismatch. An Op is detected structurally; a plain
// function is matched by (arg: Cur) => R.
type Apply<Cur, F> =
  F extends Op<infer FIn, infer FOut, any>
    ? [MatchesIn<FIn, ShapeOfCur<Cur>>] extends [never]
      ? never
      : Raw<FOut>
    : F extends (arg: Cur) => infer R
      ? R
      : never;

// Validate the remaining chain after the first fn, threading concrete output
// value types forward. Each subsequent fn must accept the previous output.
type Tail<Fns, Cur> = Fns extends [infer F, ...infer Rest]
  ? Apply<Cur, F> extends never
    ? never
    : Apply<Cur, F> extends infer R
      ? Rest extends []
        ? [(arg: Cur) => R]
        : [(arg: Cur) => R, ...Tail<Rest, R>]
      : never
  : [];

// Compose-form chain: the first element's input derives from its OWN signature
// (compose has no data), so it is never checked against anything.
type ComposeChain<Fns> = Fns extends [infer F, ...infer Rest]
  ? F extends Op<infer FIn, infer FOut, any>
    ? [(arg: Raw<FIn>) => Raw<FOut>, ...Tail<Rest, Raw<FOut>>]
    : F extends (arg: infer A) => infer R
      ? Rest extends []
        ? [(arg: A) => R]
        : [(arg: A) => R, ...Tail<Rest, R>]
      : never
  : never;

// Intended input value type of a composed chain (first fn's input).
type ComposeIn<Fns> =
  ComposeChain<Fns> extends [(arg: infer A) => any, ...unknown[]] ? A : never;

// Result value type of a composed chain (last fn's output).
type ComposeResult<Fns> =
  ComposeChain<Fns> extends [...unknown[], (arg: any) => infer R] ? R : never;

// First fn's In claim if the chain starts with an Op, else never.
type FirstIn<Fns> = Fns extends [infer F, ...unknown[]]
  ? F extends Op<infer I, any, any>
    ? I
    : never
  : never;

export type ComposeFns<Fns extends unknown[], Acc> = Fns extends [
  (arg: Acc) => infer R,
  ...infer Rest,
]
  ? Rest extends []
    ? [(arg: Acc) => R]
    : [(arg: Acc) => R, ...ComposeFns<Rest, R>]
  : never;

export type ComposeReturn<Fns extends unknown[]> = Fns extends [
  ...unknown[],
  (arg: any) => infer R,
]
  ? R
  : never;

// Returns a plain function, applies nothing until called.
export function compose<Fns extends unknown[]>(
  ...fns: Fns & ComposeChain<Fns>
): (x: ComposeIn<Fns>) => ComposeResult<Fns>;
export function compose(...fns: Array<(x: any) => any>): (x: any) => any {
  return (x: any) => fns.reduce((acc, fn) => fn(acc), x);
}

// Data-first: applies now instead of returning a func. Two overloads — an
// Op-first chain shape-gates the data (bare literal, no cast); a plain
// function chain keeps the older (arg: A) => R validation.
export function pipe<D, Fns extends unknown[]>(
  data: D & Check<FirstIn<Fns>, D>,
  ...fns: Fns & ComposeChain<Fns>
): ComposeResult<Fns>;
export function pipe<
  A,
  Fns extends [(arg: A) => any, ...Array<(arg: any) => any>],
>(data: A, ...fns: Fns & ComposeFns<Fns, A>): ComposeReturn<Fns>;
export function pipe(data: any, ...fns: Array<(x: any) => any>): any {
  return (compose as (...fns: Array<(x: any) => any>) => (x: any) => any)(
    ...fns,
  )(data);
}
