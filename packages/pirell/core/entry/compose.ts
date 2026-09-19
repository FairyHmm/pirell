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

// Branded `"chain"`: surfaces route this to the chain wiring below
// (type-only; the runtime value is just the impl).
/**
 * Runs functions left to right, returning a reusable pipeline applied to
 * data later.
 */
export const compose: SpecialOp<"chain", typeof composeImpl> = composeImpl;

type ChainFns<S> = [
  (arg: CurrentData<S>) => unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- param must accept every fn shape; unknown would reject typed params by contravariance. Return already narrowed to unknown.
  ...Array<(arg: any) => unknown>,
];

/** A chain op's surface method: bound re-binds to the composed result; deferred stays deferred. */
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
          ): Assembled<
            Bound<ShapeOf<ComposeResult<Fns>>, ComposeResult<Fns>>,
            Ops
          >;
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

// Cast, not proven: `Flatten` can't walk `compose`'s overload, so one
// honest `as`; runtime covered by the pipe suite in `compose.test.ts`.
/** Data-first {@linkcode compose}. */
export const pipe =
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- documented below: Flatten can't walk compose's overload, so the single as (not as unknown as) is the honest unchecked assertion
  makeFlat(compose) as PipeFn;
