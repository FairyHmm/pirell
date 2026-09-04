import type { Op } from "../types/base.js";
import { valueOf } from "./surface.js";

// Two calling conventions: extend(surface, ops) or extend(ops)(surface)
export function extend<Ops extends Record<string, Op<any, any, any>>>(
  surface: any,
  ops: Ops,
): any;
export function extend<Ops extends Record<string, Op<any, any, any>>>(
  ops: Ops,
): (surface: any) => any;
// Args constrained to [] here: this form calls fn with zero args to reach
// its (data) => result stage. A parameterized op (e.g. nth's [i: number])
// would silently run with its argument missing — reject it at the type
// level rather than let it compile and misbehave at runtime.
export function extend(fn: Op<any, any, []>): (x: any) => any;
export function extend(surfaceOrOps: any, ops?: any): any {
  if (ops !== undefined) {
    return applyExtend(surfaceOrOps, ops);
  }
  if (typeof surfaceOrOps === "function") {
    // Unwrap a surface to its raw value before calling fn; a bare value
    // passes through. Both typeof checks matter (surfaces are callable fns).
    // fn is a curried zero-arg Op here — call with no args to reach the
    // (data) => result stage before applying to raw.
    if (surfaceOrOps.length !== 0) {
      throw new TypeError(
        `extend(fn): fn expects ${surfaceOrOps.length} argument(s) — parameterized ops aren't supported by this form (their argument would be silently missing). Wire it via extend(surface, { name: fn }) instead, or pre-apply the argument: extend(fn(arg)).`,
      );
    }
    return (surfaceOrValue: any) => {
      const raw = valueOf(surfaceOrValue);
      return surfaceOrOps()(raw);
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
