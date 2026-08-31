import type { Op, Raw, Shape } from "../types/types.js";
import type { Check, MatchesIn, ShapeOf } from "../types/match.js";

// Function composition, usable with Ops or plain unary fns, shape-checked
// at compile time.

// Shape a value carries at the current position (Raw<S> phantom, else structural).
type ShapeOfCur<Cur> =
  Cur extends Raw<infer S extends Shape> ? S : ShapeOf<Cur> & Shape;

// Apply fn F to Cur: F's output value type, or never on shape/link mismatch.
type Apply<Cur, F> =
  F extends Op<infer FIn, infer FOut, any>
    ? [MatchesIn<FIn, ShapeOfCur<Cur>>] extends [never]
      ? never
      : Raw<FOut>
    : F extends (arg: Cur) => infer R
      ? R
      : never;

// Thread concrete output value types forward; reused by assemble.ts's fluent
// .pipe()/.compose().
export type Tail<Fns, Cur> = Fns extends [infer F, ...infer Rest]
  ? Apply<Cur, F> extends never
    ? never
    : Apply<Cur, F> extends infer R
      ? Rest extends []
        ? [(arg: Cur) => R]
        : [(arg: Cur) => R, ...Tail<Rest, R>]
      : never
  : [];

// Compose's first element input derives from its own signature (no data),
// so it's unchecked.
type ComposeChain<Fns> = Fns extends [infer F, ...infer Rest]
  ? F extends Op<infer FIn, infer FOut, any>
    ? [(arg: Raw<FIn>) => Raw<FOut>, ...Tail<Rest, Raw<FOut>>]
    : F extends (arg: infer A) => infer R
      ? Rest extends []
        ? [(arg: A) => R]
        : [(arg: A) => R, ...Tail<Rest, R>]
      : never
  : never;

// Last fn's output — shared by compose's and pipe's Op-first overloads.
type ComposeResult<Fns> =
  ComposeChain<Fns> extends [...unknown[], (arg: any) => infer R] ? R : never;

// First fn's In if the chain starts with an Op, else never.
type FirstIn<Fns> = Fns extends [infer F, ...unknown[]]
  ? F extends Op<infer I, any, any>
    ? I
    : never
  : never;

// Plain-fn-only chain: bare fns structurally match Op<any,any,any>, so Tail
// would misfire into Apply's Op branch.
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

// Deferred: returns a function, applies nothing until called.
export function compose<Fns extends unknown[]>(
  ...fns: Fns & ComposeChain<Fns>
): (
  x: ComposeChain<Fns> extends [(arg: infer A) => any, ...unknown[]]
    ? A
    : never,
) => ComposeResult<Fns>;
export function compose(...fns: Array<(x: any) => any>): (x: any) => any {
  return (x: any) => fns.reduce((acc, fn) => fn(acc), x);
}

// Data-first: applies now. Op-first overload shape-gates the data (bare
// literal, no cast); a plain chain uses ComposeFns/ComposeReturn.
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
