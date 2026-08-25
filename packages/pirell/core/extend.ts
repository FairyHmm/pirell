import type { Op } from "./types.js";

// Loop over ops and attach each as a bound method on target, using the caller-supplied apply strategy
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

// Pipe-compatible wrapper: delegates to surface.extend(ops), which the assembly layer wired
export function extend<Ops extends Record<string, Op<any, any, any, any, any>>>(
  ops: Ops,
) {
  return <S extends { extend: (ops: Ops) => any }>(
    surface: S,
  ): ReturnType<S["extend"]> => surface.extend(ops);
}
