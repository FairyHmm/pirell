import type { Op } from "../types/base.js";
import type { OpMap } from "./assemble.js";
import { valueOf } from "./surface.js";

/**
 * Wires new ops onto a surface. Accepts anything registrable: a data
 * op, or a factory yielding one once applied.
 *
 * ```ts
 * import { pirell } from "@pirell/core";
 *
 * const double = () => (ns: number[]) => ns.map((n) => n * 2);
 * const $ = pirell().extend({ double });
 * $([1, 2]).double().value; // [2, 4]
 * ```
 *
 * Published compositions annotate the result `Extended<typeof ops>`
 * (see `Extended`); shape checking fires at each op call, not at
 * registration.
 */
export function extend<Ops extends OpMap>(surface: any, ops: Ops): any;
export function extend<Ops extends OpMap>(ops: Ops): (surface: any) => any;
// Data op only: a factory applied here would take the data as its key
// argument and hand back a function, so reject function-typed results
// at the type level (and re-check at runtime for untyped callers).
export function extend<F extends (data: any) => unknown>(
  fn: F & (ReturnType<F> extends (...args: any[]) => any ? never : unknown),
): (x: any) => any;
export function extend(surfaceOrOps: any, ops?: any): any {
  if (ops !== undefined) {
    return applyExtend(surfaceOrOps, ops);
  }
  if (typeof surfaceOrOps === "function") {
    // Unwrap surfaces to raw value first (both typeof checks matter:
    // surfaces are callable fns); then run the op on the raw data.
    return (surfaceOrValue: any) => {
      const raw = valueOf(surfaceOrValue);
      const out = surfaceOrOps(raw);
      if (typeof out === "function") {
        throw new TypeError(
          "extend(fn): fn returned a function — parameterized ops aren't supported by this form (the data was taken as the op's argument). Wire it via extend(surface, { name: fn }) instead, or pre-apply the argument: extend(fn(arg)).",
        );
      }
      return out;
    };
  }
  return (surface: any) => applyExtend(surface, surfaceOrOps);
}

function applyExtend(surface: any, ops: OpMap): any {
  if (typeof surface.extend !== "function") {
    throw new TypeError(
      "extend(surface, ops): surface has no .extend() method — pass an assembled pirell() surface.",
    );
  }
  return surface.extend(ops);
}
