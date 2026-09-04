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

// The proven-shape half of a Step pair is ShapeOf<R> as-is: intersecting
// it with Shape (the old ProvenShape alias) broke the very next link,
// because MatchShape's [infer Head extends Elem, ...] destructure fails
// against an intersection while the clean tuple matches (proven by
// scratch probe during the Angle-2 investigation — every bare->Op chain
// was rejected before this fix).

// Both ends of the chain, read off the single ComposeChain computation:
// the first link's In feeds the input gate, the last link's Out feeds the
// result projection. Previously two separate walks (FirstIn over raw Fns,
// LastOut over the normalized chain) — one ends-of-chain concept instead.
// The first link is already normalized by ComposeChain (Op stays Op, bare
// thunk stays thunk), so the []-args gate reads the same here as on raw
// Fns; a parameterized first link already poisons ComposeChain to never
// at the fns param. The extends-Shape guards keep the degenerate empty
// chain (already rejected at the param) from leaking unknown through the
// vacuous-never match.
type ChainEnds<Fns extends readonly unknown[]> =
  ComposeChain<Fns> extends [infer First, ...unknown[]]
    ? ComposeChain<Fns> extends [...unknown[], infer Last]
      ? [
          First extends Op<infer FIn extends Shape, any, []> ? FIn : ["..."],
          IsThunk<Last> extends true
            ? Last extends Op<any, infer LOut extends Shape, any>
              ? Raw<LOut>
              : Last extends () => (data: any) => infer R
                ? R
                : never
            : Last extends (arg: any) => infer R
              ? R
              : never,
        ]
      : never
    : never;

// Shared by compose's return and pipe's signature so the data gate can't
// drift between the two call sites.
export type ComposeGate<Fns extends readonly unknown[], D> = D &
  CheckData<ChainEnds<Fns>[0] extends infer I extends Shape ? I : ["..."], D>;

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
        ? [R, ShapeOf<R>]
        : never
    : F extends (arg: Cur) => infer R
      ? [R, ShapeOf<R>]
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
// Non-tuple (spread) chains keep each link's own signature — length is
// unknown so per-link threading is impossible; spreads are unchecked by
// design (see compose.test.ts), same as ComposeChain's non-tuple arm.
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
      ? Array<F>
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
              : [() => (data: A) => R, ...Tail<Rest, R, ShapeOf<R>>]
            : never
        : F extends (arg: infer A) => infer R
          ? Rest extends []
            ? [(arg: A) => R]
            : [(arg: A) => R, ...Tail<Rest, R, ShapeOf<R>>]
          : never
      : never
    : Fns extends Array<infer F>
      ? F extends (arg: infer A) => infer R
        ? Array<(arg: A) => R>
        : Array<F>
      : never;

export type ComposeResult<Fns extends readonly unknown[]> =
  IsTuple<Fns> extends true ? ChainEnds<Fns>[1] : unknown; // non-tuple chain: statically untraceable, runtime still applies left-to-right
