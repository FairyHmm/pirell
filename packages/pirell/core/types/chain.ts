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

// Shape a value carries at the current position (Raw<S> brand, else
// structural inference via ShapeOf). See PLAN.md re: assemble.ts's
// CurrentData, one layer above this, not a duplicate.
type ShapeOfCur<Cur> =
  Cur extends Raw<infer S extends Shape> ? S : ShapeOf<Cur> & Shape;

// F's output value type, or never on shape/link mismatch.
type Apply<Cur, F> =
  IsThunk<F> extends true
    ? F extends Op<infer FIn, infer FOut, infer FArgs>
      ? FArgs extends []
        ? MatchesShape<FIn, ShapeOfCur<Cur>> extends true
          ? Raw<FOut>
          : never
        : never
      : F extends () => (data: any) => infer R
        ? R
        : never
    : F extends (arg: Cur) => infer R
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
// .pipe()/.compose(). A non-tuple array (length number, e.g. the untyped
// runtime bridges in assemble.ts) can't be recursed tuple-style — map the
// element instead of diverging.
export type Tail<Fns extends readonly unknown[], Cur> = number extends Fns["length"]
  ? Fns extends Array<infer F>
    ? Array<Link<F, Cur, Apply<Cur, F>>>
    : never
  : Fns extends [infer F, ...infer Rest]
    ? Apply<Cur, F> extends never
      ? never
      : Apply<Cur, F> extends infer R
        ? Rest extends []
          ? [Link<F, Cur, R>]
          : [Link<F, Cur, R>, ...Tail<Rest, R>]
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
        ? [Op<FIn, FOut, []>, ...Tail<Rest, Raw<FOut>>]
        : never
      : F extends () => (data: infer A) => infer R
        ? Rest extends []
          ? [() => (data: A) => R]
          : [() => (data: A) => R, ...Tail<Rest, R>]
        : never
    : F extends (arg: infer A) => infer R
      ? Rest extends []
        ? [(arg: A) => R]
        : [(arg: A) => R, ...Tail<Rest, R>]
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

// The two public call shapes, named so makeFlat/makeCurry (ops.ts) can
// convert between them with no cast. Mirror compose.ts's `compose`
// overload and `pipe` const exactly — keep in sync.
export type ComposeFn = <Fns extends unknown[]>(
  ...fns: Fns & ComposeChain<Fns>
) => <D>(data: Gate<Fns, D>) => ComposeResult<Fns>;

export type PipeFn = <D, Fns extends unknown[]>(
  data: Gate<Fns, D>,
  ...fns: Fns & ComposeChain<Fns>
) => ComposeResult<Fns>;
