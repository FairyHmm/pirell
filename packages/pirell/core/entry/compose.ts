import type { ComposeChain, ComposeResult, FirstData } from "../types/chain.js";
import { makeFlat } from "../ops/ops.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- impl-stage call shape: must accept every fn an overload can hand over; unknown's param would reject concrete fns by contravariance
type Stage = (x: any) => any;

// Overloaded pipeline impl — the `compose` export sits below, after the body.
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
 * Runs functions left to right, returning a reusable pipeline applied to
 * data later.
 */
export const compose = composeImpl;

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
