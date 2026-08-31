import type { Op } from "../types/types.js";
import { isSurface, valueOf } from "./surface.js";

// Registers ops by name only; shape-checking lives at the Op signature
// and in assemble.ts's chain typing.
export function wireOps<Ops extends Record<string, Op<any, any, any>>>(
  target: any,
  ops: Ops,
  apply: (op: Op<any, any, any>, args: any[]) => unknown,
): void {
  for (const name of Object.keys(ops)) {
    const opFn = ops[name]!;
    target[name] = (...args: any[]) => apply(opFn, args);
  }
}

// Two calling conventions: extend(surface, ops) or extend(ops)(surface)
export function extend<Ops extends Record<string, Op<any, any, any>>>(
  surface: any,
  ops: Ops,
): any;
export function extend<Ops extends Record<string, Op<any, any, any>>>(
  ops: Ops,
): (surface: any) => any;
export function extend(fn: Op<any, any, any>): (x: any) => any;
export function extend(surfaceOrOps: any, ops?: any): any {
  if (ops !== undefined) {
    return applyExtend(surfaceOrOps, ops);
  }
  if (typeof surfaceOrOps === "function") {
    // Unwrap a surface to its raw value before calling fn; a bare value
    // passes through. Both typeof checks matter (surfaces are callable fns).
    return (surfaceOrValue: any) => {
      const raw = isSurface(surfaceOrValue)
        ? valueOf(surfaceOrValue)
        : surfaceOrValue;
      return surfaceOrOps(raw);
    };
  }
  return (surface: any) => applyExtend(surface, surfaceOrOps);
}

function applyExtend(
  surface: any,
  ops: Record<string, Op<any, any, any>>,
): any {
  if (typeof surface.extend !== "function") {
    throw new TypeError(
      "extend(surface, ops): surface has no .extend() method — pass an assembled pirell() surface.",
    );
  }
  return surface.extend(ops);
}
