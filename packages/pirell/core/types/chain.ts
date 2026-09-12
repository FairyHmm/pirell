import type { Op, Raw, Shape } from "./base.js";
import type { DataOf } from "./codec.js";

// --- Shape gate for compose/pipe ---

// A zero-arg fn returning a fn is a curried Op-shaped link, matched by
// call shape alone — no nominal Op brand. Mirrors compose's own runtime
// check (`fn.length === 0 ? fn() : fn`).
type IsThunk<F> = F extends () => (data: any) => any ? true : false;

// Non-tuple arrays (length number) can't recurse tuple-style — map instead.
type IsTuple<Fns extends readonly unknown[]> = number extends Fns["length"]
  ? false
  : true;

// Both ends read off one ComposeChain walk (first In feeds input,
// last Out feeds result). extends-Shape guards keep the degenerate
// empty chain from leaking unknown through a vacuous-never match.
// Single-link chains get their own arm: [F, ...M, L] needs two fixed
// positions, so a 1-tuple never matches it (pre-existing gap — single
// pipes used to resolve never).
type ChainResult<F> =
  IsThunk<F> extends true
    ? F extends Op<any, infer LOut extends Shape>
      ? Raw<LOut>
      : F extends () => (data: any) => infer R
        ? R
        : never
    : F extends (arg: any) => infer R
      ? R
      : never;

type ChainEntry<F> = F extends Op<infer FIn extends Shape, any> ? FIn : ["..."];

type ChainEnds<Fns extends readonly unknown[]> =
  ComposeChain<Fns> extends [infer Only]
    ? [ChainEntry<Only>, ChainResult<Only>]
    : ComposeChain<Fns> extends [infer First, ...infer _M, infer Last]
      ? [ChainEntry<First>, ChainResult<Last>]
      : never;

// First link's In (superseded by FirstData below, kept for compatibility).
// ["..."] wherever the chain gives up (non-Op / parameterized / empty).
export type FirstIn<Fns extends readonly unknown[]> =
  ComposeChain<Fns> extends [infer First, ...unknown[]]
    ? First extends Op<infer FIn extends Shape, any>
      ? FIn
      : ["..."]
    : ["..."];

// Concrete entry-data type from the first link's own annotation (no
// DataOf re-derivation). Routing mirrors FirstIn exactly, so give-ups
// stay identical.
export type FirstData<Fns extends readonly unknown[]> =
  Fns extends [infer F, ...unknown[]]
    ? IsThunk<F> extends true
      ? F extends (...args: any[]) => (data: infer D0) => any
        ? D0
        : unknown
      : F extends Op<infer FIn extends Shape, any>
        ? F extends (data: infer D0) => any
          ? D0
          : unknown
        : unknown
    : IsTuple<Fns> extends true
      ? never
      : unknown;

// Mismatch is a shape ({ok: false}), not a bare never a tuple pattern
// would match vacuously. Declared ops check against their own annotation's
// param/return (already elaborated, cached) instead of decomposing Op and
// rebuilding DataOf/Raw per link — same check, no reconstruction.
type Step<F, Cur> =
  IsThunk<F> extends true
    ? F extends (...args: any[]) => (data: infer D0) => infer R0
      ? Cur extends D0
        ? { ok: true; r: R0; l: F }
        : { ok: false }
      : { ok: false }
    : F extends (arg: Cur) => infer R
      ? { ok: true; r: R; l: F }
      : { ok: false };

// Concretely typed links for assemble.ts's .pipe()/.compose(). Threads
// the raw value only — no proven-shape channel. Spreads keep each link's
// own signature (length unknown, so threading is impossible: unchecked).
export type Tail<Fns extends readonly unknown[], Cur> =
  IsTuple<Fns> extends true
    ? Fns extends [infer F, ...infer Rest]
      ? Step<F, Cur> extends {
          ok: true;
          r: infer R;
          l: infer L;
        }
        ? Rest extends []
          ? [L]
          : [L, ...Tail<Rest, R>]
        : never
      : []
    : Fns extends Array<infer F>
      ? Array<F>
      : never;

// First link keeps its double-curried Op type (passed un-invoked); later
// links are threaded — different positions, not duplication. Links keep
// their own declared types (no Op/Raw reconstruction — see Step).
export type ComposeChain<Fns extends readonly unknown[]> =
  IsTuple<Fns> extends true
    ? Fns extends [infer F, ...infer Rest]
      ? IsThunk<F> extends true
        ? F extends (...args: any[]) => (data: any) => infer R
          ? [F, ...Tail<Rest, R>]
          : never
        : F extends (arg: infer A) => infer R
          ? Rest extends []
            ? [F]
            : [F, ...Tail<Rest, R>]
          : never
      : never
    : Fns extends Array<infer F>
      ? F extends (arg: infer A) => infer R
        ? Array<(arg: A) => R>
        : Array<F>
      : never;

export type ComposeResult<Fns extends readonly unknown[]> =
  IsTuple<Fns> extends true ? ChainEnds<Fns>[1] : unknown; // non-tuple chain: statically untraceable, runtime still applies left-to-right
