import type {
  ComposeChain,
  ComposeResult,
  ComposeGate,
} from "../types/chain.js";
import { makeFlat } from "../ops/ops.js";

// Untyped runtime shared by the typed compose wrapper below and the
// surface builders (which thread untyped step arrays, not Fns tuples).
// The stage-invoke + stage-error contract lives here, in exactly one
// place — builders call this directly instead of re-casting compose.
export function composeRaw(...fns: Array<(x: any) => any>): (x: any) => any {
  // A zero-arg Op arrives curried — one extra call yields the (data) => R
  // stage; a bare fn is already that stage.
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

// Returns a function — data is applied later, shape-gated at that call.
export function compose<Fns extends unknown[]>(
  ...fns: Fns & ComposeChain<Fns>
): <D>(data: ComposeGate<Fns, D>) => ComposeResult<Fns>;
export function compose(...fns: Array<(x: any) => any>): (x: any) => any {
  return composeRaw(...fns);
}

// Data-first view of compose. makeFlat is a shape-agnostic form converter,
// so `makeFlat(compose)` carries no gate — the gate is authored here, at
// compose/pipe's own site (not in makeFlat). Same ComposeGate/ComposeChain/
// ComposeResult compose uses, flipped to (data, ...fns).
type PipeFn = <D, Fns extends unknown[]>(
  data: ComposeGate<Fns, D>,
  ...fns: Fns & ComposeChain<Fns>
) => ComposeResult<Fns>;

export const pipe: PipeFn = makeFlat(compose) as unknown as PipeFn;
