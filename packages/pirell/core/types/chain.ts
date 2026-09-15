import type { Op, Raw, Shape } from "./base.js";
import type { DataOf } from "./codec.js";

// --- Shape gate for compose/pipe ---

// A zero-arg fn returning a fn is a curried Op-shaped link, matched by
// call shape alone (mirrors compose's runtime `fn.length === 0` check).
type IsThunk<F> = F extends () => (data: any) => any ? true : false;

// Non-tuple arrays (length number) can't recurse tuple-style — map instead.
type IsTuple<Fns extends readonly unknown[]> = number extends Fns["length"]
  ? false
  : true;

// Both ends read off one ComposeChain walk (first In feeds input, last
// Out feeds result). extends-Shape guards block the vacuous-never
// empty-chain leak.
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

// First link's own data param, no DataOf re-derivation. Give-ups match
// ComposeChain's.
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

// Mismatch is a `{ok: false}` shape, not a bare never (tuple patterns
// match never vacuously). Declared ops check their own annotation's
// param/return — no Op decomposition or DataOf/Raw rebuild per link.
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

// Threads the raw value only — no proven-shape channel. Non-tuple
// arrays keep each link's own signature (threading impossible:
// unchecked, so compose's runtime error gains context).
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

// First link stays double-curried (passed un-invoked, declared Op type
// intact); later links are threaded. Links keep their own declared
// types — no Op/Raw reconstruction (see Step).
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
