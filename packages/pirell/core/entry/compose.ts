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

// Data-first view of compose. makeFlat is a shape-agnostic form converter,
// so `makeFlat(compose)` carries no gate — the gate is authored here, at
// compose/pipe's own site (not in makeFlat). Same Gate/ComposeChain/
// ComposeResult compose uses, flipped to (data, ...fns).
type PipeFn = <D, Fns extends unknown[]>(
  data: Gate<Fns, D>,
  ...fns: Fns & ComposeChain<Fns>
) => ComposeResult<Fns>;

export const pipe: PipeFn = makeFlat(compose) as unknown as PipeFn;
