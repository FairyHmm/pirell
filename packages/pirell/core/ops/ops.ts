// Function-calling-convention converters. Ops are authored in the curried
// form directly; these bridge to/from the flat (data, ...args) form for the
// rare data-first call sites.

import type {
  ComposeChain,
  ComposeResult,
  Gate,
  PipeFn,
} from "../types/chain.js";

// makeCurry: flat (data, ...args) => result → curried (...args) => (data) => result.
// A gated flat fn (pipe-shaped) curries back to the gated compose shape —
// D must be quantified at the INNER data call (like compose itself) so it's
// inferred once data arrives, not at the fns call. Fns re-quantifies per
// compose call, so no inference passes through makeCurry itself.
export function makeCurry<F extends PipeFn>(fn: F): <Fns extends unknown[]>(
  ...fns: Fns & ComposeChain<Fns>
) => <D>(data: Gate<Fns, D>) => ComposeResult<Fns>;
export function makeCurry<A extends unknown[], D, R>(
  fn: (data: D, ...args: A) => R,
): (...args: A) => (data: D) => R;
export function makeCurry(
  fn: (data: any, ...args: any[]) => any,
): (...args: any[]) => (data: any) => any {
  return (...args: any[]) =>
    (data: any) =>
      fn(data, ...args);
}

// Type-level curried → flat, preserving data type params from the source
// (`(data: X<D>) => R`). The generic path below can't carry a constrained
// rest param through inference (the gate would erase) — a gated
// compose-shaped fn gets its own overload instead, which re-attaches the
// gate directly.
type Flatten<F> = F extends (...args: infer A) => (data: infer Data) => infer R
  ? (data: Data, ...args: A) => R
  : never;

// makeFlat: curried → flat; the runtime backing for pipe. A gated
// compose-shaped curried fn flattens to the gated pipe signature; anything
// else uses the generic Flatten.
export function makeFlat<
  F extends (...args: any[]) => <D>(data: D) => any,
>(fn: F): PipeFn;
export function makeFlat<F extends (...args: any) => any>(fn: F): Flatten<F>;
export function makeFlat(
  fn: (...args: any[]) => (data: any) => any,
): (data: any, ...args: any[]) => any {
  return (data: any, ...args: any[]) => fn(...args)(data);
}
