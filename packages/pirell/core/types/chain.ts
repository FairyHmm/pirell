import type { Op, Raw, Shape } from "./types.js";
import type { MatchesShape, ShapeOf, Check } from "./match.js";

// --- Shape gate for compose/pipe ---

// A zero-arg fn returning a fn is a curried Op-shaped link, matched by
// call shape alone — no nominal Op brand. Mirrors compose's own runtime
// check (`fn.length === 0 ? fn() : fn`).
type IsThunk<F> = F extends () => (data: any) => any ? true : false;

// First link's In when it's a zero-arg Op-shaped thunk with a declared
// Op<FIn,...> type; otherwise ["..."] (uncheckable first link).
type FirstIn<Fns> = Fns extends [infer F, ...unknown[]]
  ? IsThunk<F> extends true
    ? F extends Op<infer FIn, any, infer FArgs>
      ? FArgs extends []
        ? FIn
        : ["..."]
      : ["..."]
    : ["..."]
  : never;

// Shared by compose's return and pipe's signature so the data gate can't
// drift between the two call sites.
export type Gate<Fns, D> = D & Check<FirstIn<Fns>, D>;

// One link step: [output value type, output shape]. A thunk link with a
// declared Op type matches against the threaded proven shape and carries
// FOut forward with zero inference — the previous link built this value as
// Raw<FOut>, so re-inferring its shape from the value (the old ShapeOfCur)
// paid ~300 instantiations/link to rediscover what was already declared.
// Inference (ShapeOf) runs only where no declared shape exists: bare
// thunk / plain-fn link outputs.
type Step<F, Cur, CurShp extends Shape> =
  IsThunk<F> extends true
    ? F extends Op<infer FIn, infer FOut, infer FArgs>
      ? FArgs extends []
        ? MatchesShape<FIn, CurShp> extends true
          ? [Raw<FOut>, FOut]
          : never
        : never
      : F extends () => (data: any) => infer R
        ? [R, ShapeOf<R> & Shape]
        : never
    : F extends (arg: Cur) => infer R
      ? [R, ShapeOf<R> & Shape]
      : never;

// Value half of a Step. The never-guard is load-bearing: Step<F,...> is
// not a naked param, so `Step<...> extends [infer R, any]` would be
// vacuously TRUE on a never Step (never is assignable to everything),
// inferring R=unknown instead of propagating the mismatch.
type StepVal<F, Cur, CurShp extends Shape> = Step<F, Cur, CurShp> extends never
  ? never
  : Step<F, Cur, CurShp> extends [infer R, any]
    ? R
    : never;

// Expected tuple element for a link: a zero-arg Op is passed un-invoked,
// so it stays double-curried; a plain fn is already single-arg.
type Link<F, Cur, R> = IsThunk<F> extends true
  ? F extends Op<infer FIn, infer FOut, infer FArgs>
    ? FArgs extends []
      ? Op<FIn, FOut, []>
      : never
    : F
  : (arg: Cur) => R;

// Concretely typed links; exported for reuse by assemble.ts's fluent
// .pipe()/.compose(). Threads the value (Cur, for Link/Result) alongside
// its proven shape (CurShp, for matching). The never-guard is load-bearing:
// Step<F,...> is not a naked param, so the tuple destructure below would be
// vacuously true on a never Step (never is assignable to everything) and
// swallow the mismatch. A non-tuple array (length number, e.g. the untyped
// runtime bridges in assemble.ts) can't be recursed tuple-style — map the
// element instead of diverging.
export type Tail<Fns extends readonly unknown[], Cur, CurShp extends Shape> =
  number extends Fns["length"]
    ? Fns extends Array<infer F>
      ? Array<Link<F, Cur, StepVal<F, Cur, CurShp>>>
      : never
    : Fns extends [infer F, ...infer Rest]
      ? Step<F, Cur, CurShp> extends never
        ? never
        : Step<F, Cur, CurShp> extends [infer R, infer RShp extends Shape]
          ? Rest extends []
            ? [Link<F, Cur, R>]
            : [Link<F, Cur, R>, ...Tail<Rest, R, RShp>]
          : never
      : [];

// First link keeps its double-curried Op type — the op itself is passed
// positionally, un-invoked; Tail/Link type the remaining links the same way.
export type ComposeChain<Fns extends readonly unknown[]> = number extends Fns["length"]
  ? Fns extends Array<infer F>
    ? F extends (arg: infer A) => infer R
      ? Array<(arg: A) => R>
      : Array<F>
    : never
  : Fns extends [infer F, ...infer Rest]
    ? IsThunk<F> extends true
      ? F extends Op<infer FIn, infer FOut, infer FArgs>
        ? FArgs extends []
          ? [Op<FIn, FOut, []>, ...Tail<Rest, Raw<FOut>, FOut>]
          : never
        : F extends () => (data: infer A) => infer R
          ? Rest extends []
            ? [() => (data: A) => R]
            : [() => (data: A) => R, ...Tail<Rest, R, ShapeOf<R> & Shape>]
          : never
      : F extends (arg: infer A) => infer R
        ? Rest extends []
          ? [(arg: A) => R]
          : [(arg: A) => R, ...Tail<Rest, R, ShapeOf<R> & Shape>]
        : never
  : never;

export type ComposeResult<Fns extends readonly unknown[]> =
  number extends Fns["length"]
    ? unknown // non-tuple chain: statically untraceable, runtime still applies left-to-right
    : ComposeChain<Fns> extends [...unknown[], infer Last]
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
