import type { ComposeChain, ComposeResult, Gate } from "../types/chain.js";
import { makeFlat } from "../ops/ops.js";

// Returns a function — data is applied later, shape-gated at that call.
export function compose<Fns extends unknown[]>(
  ...fns: Fns & ComposeChain<Fns>
): <D>(data: Gate<Fns, D>) => ComposeResult<Fns>;
export function compose(...fns: Array<(x: any) => any>): (x: any) => any {
  // A zero-arg Op arrives curried — one extra call yields the (data) => R
  // stage; a bare fn is already that stage.
  const stages = fns.map((fn) => (fn.length === 0 ? (fn as () => any)() : fn));
  return (x: any) =>
    stages.reduce((acc, fn, i) => {
      try {
        return fn(acc);
      } catch (err) {
        // Shape checking is a compile-time-only property (Op's In/Out
        // shape carries no runtime tag, by design — see PLAN.md's brand
        // removal). A literal-tuple call (`pipe(data, a, b)`) gets that
        // checking from ComposeChain/Tail; a spread array of fns
        // (`pipe(data, ...fns)`) widens to Fns["length"]: number, which
        // TypeScript can't index per-link — so mismatches here surface
        // only at runtime, as whatever error the stage itself throws.
        // Re-thrown with stage context so the failure is diagnosable
        // without needing to know that distinction up front.
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

// Data-first view of compose. makeFlat is a shape-agnostic form converter,
// so `makeFlat(compose)` carries no gate — the gate is authored here, at
// compose/pipe's own site (not in makeFlat). Same Gate/ComposeChain/
// ComposeResult compose uses, flipped to (data, ...fns).
type PipeFn = <D, Fns extends unknown[]>(
  data: Gate<Fns, D>,
  ...fns: Fns & ComposeChain<Fns>
) => ComposeResult<Fns>;

export const pipe: PipeFn = makeFlat(compose) as unknown as PipeFn;
