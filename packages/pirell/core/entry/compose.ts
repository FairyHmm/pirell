import type {
  ComposeChain,
  ComposeResult,
  FirstData,
} from "../types/chain.js";
import { makeFlat } from "../ops/ops.js";

// Untyped runtime shared by typed compose below and the surface builders.
// Stage-invoke + stage-error contract lives here exactly once.
export function composeRaw(...fns: Array<(x: any) => any>): (x: any) => any {
  // A zero-arg thunk link is applied once to reach its (data) => R
  // stage; a data fn (op or pre-applied factory product) already is
  // that stage.
  const stages = fns.map((fn) => (fn.length === 0 ? (fn as () => any)() : fn));
  return (x: any) =>
    stages.reduce((acc, fn, i) => {
      try {
        return fn(acc);
      } catch (err) {
        // Spread-array chains skip compile-time shape checks
        // (length: number isn't indexable per-link), so a stage error
        // here is re-thrown with context instead of surfacing raw.
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
 *
 * const run = compose(
 *   (ns: number[]) => ns.map((n) => n * 2),
 *   (ns: number[]) => ns.filter((n) => n > 2),
 * );
 * run([1, 2]); // [4]
 * ```
 */
export function compose<Fns extends unknown[]>(
  ...fns: Fns & ComposeChain<Fns>
): (data: FirstData<Fns>) => ComposeResult<Fns>;
export function compose(...fns: Array<(x: any) => any>): (x: any) => any {
  return composeRaw(...fns);
}

// Data-first view of compose. The entry claim is authored here, not in
// shape-agnostic makeFlat — same Chain/Result types, flipped argument order.
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
 *
 * pipe(
 *   [1, 2],
 *   (ns: number[]) => ns.map((n) => n * 2),
 * ); // [2, 4]
 * ```
 */
export const pipe: PipeFn = makeFlat(compose) as unknown as PipeFn;
