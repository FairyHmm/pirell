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
  return (x: any) => stages.reduce((acc, fn) => fn(acc), x);
}

// Data-first view of compose, derived with no cast: makeFlat's gated
// overload re-attaches the compile-time gate (ops.ts).
export const pipe = makeFlat(compose);
