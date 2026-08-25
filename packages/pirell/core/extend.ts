import type { Op } from "./types.js";

// Shared wiring mechanism behind every .extend(ops): for each entry,
// attach a bound method to `target` that calls `apply(op, args)` and
// returns whatever `apply` produces. Wrapper and Deferred each supply
// their own `apply` (run now vs. defer), but the wiring loop is common.
export function wireOps<
  Ops extends Record<string, Op<any, any, any, any, any>>,
  R,
>(
  target: any,
  ops: Ops,
  apply: (op: Op<any, any, any, any, any>, args: any[]) => R,
): void {
  for (const name of Object.keys(ops)) {
    const op = ops[name]!;
    target[name] = (...args: any[]) => apply(op, args);
  }
}

// Standalone form of .extend(), for use as a pipe() step: applies
// extend(ops) to whatever surface (Wrapper or Deferred) it receives.
export function extend<Ops extends Record<string, Op<any, any, any, any, any>>>(
  ops: Ops,
) {
  return <S extends { extend: (ops: Ops) => any }>(surface: S) =>
    surface.extend(ops);
}
