import type { Bound, CurrentData, Deferred, OpMap } from "../types/base.js";
import type { ShapeOf } from "../types/codec.js";
import type {
  ComposeChain,
  ComposeResult,
  FirstData,
  Tail,
} from "../types/chain.js";
import type { Assembled, SpecialOp } from "../types/wrapper.js";
import { makeFlat } from "../ops/ops.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- impl-stage call shape: must accept every fn an overload can hand over; unknown's param would reject concrete fns by contravariance
type Stage = (x: any) => any;

// Overloaded pipeline impl (unbranded) — the branded `compose` export
// (plus its docs) sits below, after the body.
function composeImpl<Fns extends unknown[]>(
  ...fns: Fns & ComposeChain<Fns>
): (data: FirstData<Fns>) => ComposeResult<Fns>;
function composeImpl(...fns: Stage[]): (x: unknown) => unknown {
  // Zero-arg thunk links are applied once to reach their (data) => R
  // stage; data fns already are that stage.
  const stages: Stage[] = fns.map((fn) =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- fn.length === 0 is the only checkable sign of a thunk; dropping the required param is inherent to calling it
    fn.length === 0 ? (fn as () => Stage)() : fn,
  );
  return (x: unknown) =>
    stages.reduce((acc, fn, i) => {
      try {
        return fn(acc) as unknown;
      } catch (err) {
        // Spread-array chains skip compile-time checks; tag the stage
        // error with context instead of surfacing it raw.
        const label =
          err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        throw new Error(
          `compose/pipe: stage ${i} threw on its input (${label}). ` +
            "If this chain came from a spread array rather than a literal call " +
            "(e.g. `pipe(data, ...fns)`), shapes aren't checked at compile time for " +
            "that form — verify each stage's declared In shape matches what the " +
            "previous stage actually produces.",
          { cause: err },
        );
      }
    }, x);
}

/**
 * Runs functions left to right, returning a reusable pipeline — data
 * is applied later, checked then against the first link's entry claim.
 *
 * ```ts
 * import { compose } from "@pirell/core";
 * import type { Op } from "@pirell/core";
 *
 * type NumberTransform = Op<[["i", number]], [["i", number]]>;
 * const double: NumberTransform = (ns) =>
 *   ns.map((n) => n * 2);
 * const keep: NumberTransform = (ns) =>
 *   ns.filter((n) => n > 2);
 *
 * const run = compose(double, keep);
 * run([1, 2]); // [4]
 * ```
 *
 * Branded `"chain"`: surfaces route this to the chain wiring below.
 * Type-only — the runtime value is just the impl.
 */
export const compose: SpecialOp<"chain", typeof composeImpl> = composeImpl;

type ChainFns<S> = [
  (arg: CurrentData<S>) => unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- param must accept every fn shape; unknown would reject typed params by contravariance. Return already narrowed to unknown.
  ...Array<(arg: any) => unknown>,
];

/**
 * A chain op's surface method, living with its owner: bound re-binds
 * to the composed result; deferred append stays deferred.
 */
export type ChainMethod<S, Ops extends OpMap = Record<never, never>> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches any Deferred instantiation
  S extends Deferred<any>
    ? {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deferred chain must accept every fn shape; param any (see ChainFns)
        <Fns extends Array<(arg: any) => unknown>>(
          ...fns: Fns
        ): Assembled<S, Ops>;
      }
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches any Bound instantiation
      S extends Bound<any>
      ? {
          <Fns extends ChainFns<S>>(
            ...fns: Fns & Tail<Fns, CurrentData<S>>
          ): Assembled<Bound<ShapeOf<ComposeResult<Fns>>>, Ops>;
        }
      : never;

// compose/pipe's entry on the global registry table: the function's
// wiring paragraph, not a new module.
declare global {
  interface PirellSpecialWire<S, Ops extends OpMap> {
    /** compose/pipe: thread fns, re-wiring siblings onto the result. */
    chain: ChainMethod<S, Ops>;
  }
}

// Data-first view of {@linkcode compose}: same Chain/Result types,
// flipped argument order. The entry claim is authored here, not in
// shape-agnostic makeFlat.
type PipeFn = <Fns extends unknown[]>(
  data: FirstData<Fns>,
  ...fns: Fns & ComposeChain<Fns>
) => ComposeResult<Fns>;

/**
 * Data-first {@linkcode compose}: threads data through each function
 * left to right.
 *
 * ```ts
 * import { pipe } from "@pirell/core";
 * import type { Op } from "@pirell/core";
 *
 * const double: Op<[["i", number]], [["i", number]]> = (ns) =>
 *   ns.map((n) => n * 2);
 * pipe([1, 2], double); // [2, 4]
 * ```
 *
 * Cast, not proven: `makeFlat`'s `Flatten<F>` pattern-matches a single
 * `(...args) => (data) => R` signature, but `compose` is overloaded
 * (a generic declared signature plus its implementation signature) —
 * `Flatten` can't walk that, so the assignment isn't structurally
 * checked either way. A single `as` here (not `as unknown as`, which
 * implies the direct cast was rejected — it isn't) is the honest
 * version of the same unchecked assertion; runtime correctness is
 * covered by `compose.test.ts`'s `pipe` suite instead.
 */
export const pipe =
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- documented below: Flatten can't walk compose's overload, so the single as (not as unknown as) is the honest unchecked assertion
  makeFlat(compose) as PipeFn;
