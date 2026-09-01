import type { Op, Raw, Shape } from "../types/types.js";
import type { MatchesShape, ShapeOf, Check } from "../types/match.js";
import { makeFlat } from "../ops/ops.js";

// Function composition, usable with Ops or plain unary fns, shape-checked
// at compile time.

// Shape a value carries at the current position (Raw<S> phantom, else structural).
type ShapeOfCur<Cur> =
  Cur extends Raw<infer S extends Shape> ? S : ShapeOf<Cur> & Shape;

// Apply fn F to Cur: F's output value type, or never on shape/link mismatch.
// A zero-arg Op (Args extends []) auto-invokes as a chain link for
// convenience — Op<In,Out,[key:string]> (non-empty Args) is excluded so a
// bare parameterized op doesn't silently drop its required argument.
type Apply<Cur, F> =
  F extends Op<infer FIn, infer FOut, infer FArgs>
    ? FArgs extends []
      ? MatchesShape<FIn, ShapeOfCur<Cur>> extends true
        ? Raw<FOut>
        : never
      : never
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
// so it's unchecked. Zero-arg Op auto-invokes, same as Apply.
type ComposeChain<Fns> = Fns extends [infer F, ...infer Rest]
  ? F extends Op<infer FIn, infer FOut, infer FArgs>
    ? FArgs extends []
      ? [(arg: Raw<FIn>) => Raw<FOut>, ...Tail<Rest, Raw<FOut>>]
      : never
    : F extends (arg: infer A) => infer R
      ? Rest extends []
        ? [(arg: A) => R]
        : [(arg: A) => R, ...Tail<Rest, R>]
      : never
  : never;

// Last fn's output.
type ComposeResult<Fns> =
  ComposeChain<Fns> extends [...unknown[], (arg: any) => infer R] ? R : never;

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
  // A zero-arg Op is (...args) => (data) => R — one call with no args
  // yields the (data) => R stage; a bare fn is already that stage.
  const stages = fns.map((fn) => (fn.length === 0 ? (fn as () => any)() : fn));
  return (x: any) => stages.reduce((acc, fn) => fn(acc), x);
}

// Data-first view of compose: pipe(data, ...fns) = compose(...fns)(data).
// Runtime via makeFlat; overloads carry the call-site generics compose has.
// The Op-first overload gates data against the first fn's In via Check.
// A real Op carries __in/__out brand props; a plain (x:any)=>any callable
// structurally satisfies Op<any,any,any>'s call signature alone (params
// widen under `any`), so the brand is what actually distinguishes them.
type IsBrandedOp<F> = F extends { readonly __in?: any; readonly __out?: any }
  ? true
  : false;

export function pipe<D, Fns extends unknown[]>(
  data: Fns extends [Op<infer FIn, any, any>, ...unknown[]]
    ? D & Check<FIn, D>
    : D,
  ...fns: Fns & ComposeChain<Fns>
): ComposeResult<Fns>;
export function pipe<
  A,
  Fns extends [(arg: A) => any, ...Array<(arg: any) => any>],
>(
  data: Fns extends [infer F, ...unknown[]]
    ? IsBrandedOp<F> extends true
      ? never
      : A
    : A,
  ...fns: Fns & ComposeFns<Fns, A>
): ComposeReturn<Fns>;
export function pipe(data: any, ...fns: any[]): any {
  return makeFlat(compose as (...args: any[]) => (data: unknown) => unknown)(
    data,
    ...fns,
  );
}
