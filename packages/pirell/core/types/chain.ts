import type { Op, Raw, Shape } from "./base.js";
import type { MatchShape } from "./match-shape.js";
import type { ShapeOf } from "./codec.js";
import type { CheckData } from "./match-data.js";

// --- Shape gate for compose/pipe ---

// A zero-arg fn returning a fn is a curried Op-shaped link, matched by
// call shape alone — no nominal Op brand. Mirrors compose's own runtime
// check (`fn.length === 0 ? fn() : fn`).
type IsThunk<F> = F extends () => (data: any) => any ? true : false;

// Non-tuple arrays (length number) can't recurse tuple-style — map instead.
type IsTuple<Fns extends readonly unknown[]> = number extends Fns["length"]
  ? false
  : true;

// ShapeOf narrowed to Shape: the proven-shape half of a Step pair.
type ProvenShape<R> = ShapeOf<R> & Shape;

// First link's In when it's a zero-arg Op-shaped thunk with a declared
// Op<FIn,...> type; otherwise ["..."] (uncheckable first link). Args is
// matched against literal [] directly — every false path is ["..."] anyway.
type FirstIn<Fns> = Fns extends [infer F, ...unknown[]]
  ? IsThunk<F> extends true
    ? F extends Op<infer FIn, any, []>
      ? FIn
      : ["..."]
    : ["..."]
  : never;

// Shared by compose's return and pipe's signature so the data gate can't
// drift between the two call sites.
export type ComposeGate<Fns, D> = D & CheckData<FirstIn<Fns>, D>;

// One link step: [output value type, output shape]. A thunk link with a
// declared Op matches against the threaded proven shape and carries FOut
// forward with zero inference. ShapeOf runs only where no declared shape
// exists (bare-thunk/plain-fn outputs).
type Step<F, Cur, CurShp extends Shape> =
  IsThunk<F> extends true
    ? F extends Op<infer FIn, infer FOut, infer FArgs>
      ? FArgs extends []
        ? MatchShape<FIn, CurShp> extends true
          ? [Raw<FOut>, FOut]
          : never
        : never
      : F extends () => (data: any) => infer R
        ? [R, ProvenShape<R>]
        : never
    : F extends (arg: Cur) => infer R
      ? [R, ProvenShape<R>]
      : never;

// Value half of a Step, evaluated once (same infer-S shape as Tail).
// The never-guard is load-bearing (non-naked Step + vacuous never match
// would infer R=unknown, swallowing mismatches).
type StepVal<F, Cur, CurShp extends Shape> =
  Step<F, Cur, CurShp> extends infer S
    ? S extends never
      ? never
      : S extends [infer R, any]
        ? R
        : never
    : never;

// Expected tuple element for a link: a zero-arg Op is passed un-invoked,
// so it stays double-curried; a plain fn is already single-arg.
type Link<F, Cur, R> =
  IsThunk<F> extends true
    ? F extends Op<infer FIn, infer FOut, infer FArgs>
      ? FArgs extends []
        ? Op<FIn, FOut, []>
        : never
      : F
    : (arg: Cur) => R;

// Concretely typed links; exported for reuse by assemble.ts's fluent
// .pipe()/.compose(). Threads the value (Cur) alongside its proven shape
// (CurShp). Step is evaluated once, bound as S: `S extends never` stays a
// naked-param check, so a never Step still propagates instead of matching
// [infer R, ...] vacuously (never is assignable to everything).
export type Tail<Fns extends readonly unknown[], Cur, CurShp extends Shape> =
  IsTuple<Fns> extends true
    ? Fns extends [infer F, ...infer Rest]
      ? Step<F, Cur, CurShp> extends infer S
        ? S extends never
          ? never
          : S extends [infer R, infer RShp extends Shape]
            ? Rest extends []
              ? [Link<F, Cur, R>]
              : [Link<F, Cur, R>, ...Tail<Rest, R, RShp>]
            : never
        : never
      : []
    : Fns extends Array<infer F>
      ? Array<Link<F, Cur, StepVal<F, Cur, CurShp>>>
      : never;

// First link keeps its double-curried Op type — the op itself is passed
// positionally, un-invoked; Tail/Link type the remaining links the same way.
export type ComposeChain<Fns extends readonly unknown[]> =
  IsTuple<Fns> extends true
    ? Fns extends [infer F, ...infer Rest]
      ? IsThunk<F> extends true
        ? F extends Op<infer FIn, infer FOut, infer FArgs>
          ? FArgs extends []
            ? [Op<FIn, FOut, []>, ...Tail<Rest, Raw<FOut>, FOut>]
            : never
          : F extends () => (data: infer A) => infer R
            ? Rest extends []
              ? [() => (data: A) => R]
              : [() => (data: A) => R, ...Tail<Rest, R, ProvenShape<R>>]
            : never
        : F extends (arg: infer A) => infer R
          ? Rest extends []
            ? [(arg: A) => R]
            : [(arg: A) => R, ...Tail<Rest, R, ProvenShape<R>>]
          : never
      : never
    : Fns extends Array<infer F>
      ? F extends (arg: infer A) => infer R
        ? Array<(arg: A) => R>
        : Array<F>
      : never;

// Last link's Out: mirror image of FirstIn (chain input-gate vs
// output-projection, both wrapping ComposeChain/Tail).
type LastOut<Fns extends readonly unknown[]> =
  ComposeChain<Fns> extends [...unknown[], infer Last]
    ? IsThunk<Last> extends true
      ? Last extends Op<any, infer LOut, any>
        ? Raw<LOut>
        : Last extends () => (data: any) => infer R
          ? R
          : never
      : Last extends (arg: any) => infer R
        ? R
        : never
    : never;

export type ComposeResult<Fns extends readonly unknown[]> =
  IsTuple<Fns> extends true ? LastOut<Fns> : unknown; // non-tuple chain: statically untraceable, runtime still applies left-to-right
