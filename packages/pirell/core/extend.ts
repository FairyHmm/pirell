import { Wrapper } from "./wrapper.js";
import type { Op, Pirell } from "./types.js";

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

// Two calling conventions: extend(surface, ops) or extend(ops)(surface)
// Also accepts a single function: extend(double) — passthrough for pipe/compose compatibility
export function extend<Ops extends Record<string, Op<any, any, any, any, any>>>(
  surface: any,
  ops: Ops,
): any;
export function extend<Ops extends Record<string, Op<any, any, any, any, any>>>(
  ops: Ops,
): (surface: any) => any;
export function extend(
  fn: (data: Pirell<any, any>) => Pirell<any, any>,
): (x: any) => any;
export function extend(surfaceOrOps: any, ops?: any): any {
  if (ops !== undefined) {
    return applyExtend(surfaceOrOps, ops);
  }
  if (typeof surfaceOrOps === "function") {
    return surfaceOrOps;
  }
  return (surface: any) => applyExtend(surface, surfaceOrOps);
}

function applyExtend(
  surface: any,
  ops: Record<string, Op<any, any, any, any, any>>,
): any {
  if (typeof surface.extend === "function") {
    return surface.extend(ops);
  }
  const result = Object.keys(ops).reduce((data: Pirell<any, any>, name) => {
    const op = ops[name]!;
    return op(data);
  }, surface);
  const w = new Wrapper(result.shape, result.value);
  wireOps(w, ops, (op, args) =>
    op({ shape: w.shape, value: w.value }, ...args),
  );
  return w;
}
