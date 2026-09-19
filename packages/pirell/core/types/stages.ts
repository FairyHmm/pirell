// Stage threading for threading-shaped factories: per-link results,
// validation, last-output fold. Shared by the free-fn gate and the
// generic arm; owned by neither.
import type { Op, Raw, Shape } from "./base.js";

// A zero-arg fn returning a fn is a curried Op-shaped link, matched by
// call shape alone (mirrors compose's runtime `fn.length === 0` check).
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- match any returned data fn; unknown's param would reject concrete factories by contravariance
export type IsThunk<F> = F extends () => (data: any) => any ? true : false;

// Non-tuple arrays (length number) can't recurse tuple-style — map instead.
export type IsTuple<Fns extends readonly unknown[]> =
  number extends Fns["length"] ? false : true;

// One link's raw output, thunks unwrapped.
export type ChainResult<F> =
  IsThunk<F> extends true
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Op's In is Shape-constrained; any matches every instantiation, only Out is read
      F extends Op<any, infer LOut extends Shape>
      ? Raw<LOut>
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any -- match any data-fn return to infer R; unknown's param rejects concrete fns
        F extends () => (data: any) => infer R
        ? R
        : never
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any -- match any fn to infer its return; unknown rejects typed params
      F extends (arg: any) => infer R
      ? R
      : never;

// Mismatch is a `{ok: false}` shape, not a bare never (tuple patterns
// match never vacuously). Declared ops check their own annotation's
// param/return — no Op decomposition or DataOf/Raw rebuild per link.
type Step<F, Cur> =
  IsThunk<F> extends true
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any -- same factory-call-shape match as FirstData
      F extends (...args: any[]) => (data: infer D0) => infer R0
      ? Cur extends D0
        ? { ok: true; r: R0; l: F }
        : { ok: false }
      : { ok: false }
    : F extends (arg: Cur) => infer R
      ? { ok: true; r: R; l: F }
      : { ok: false };

// Threads the raw value only — no proven-shape channel. Non-tuple
// arrays keep each link's own signature (threading impossible:
// unchecked, so the runtime error gains context instead).
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

// Last link's output. Validation lives in the args position (Tail), so
// the fold stays direct; non-tuples are statically untraceable.
export type ThreadResult<Fns extends readonly unknown[]> =
  IsTuple<Fns> extends true
    ? Fns extends [...unknown[], infer Last]
      ? ChainResult<Last>
      : unknown
    : unknown;
