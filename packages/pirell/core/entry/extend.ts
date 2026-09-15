import type { ExtendResult, OpMap } from "../types/assembled.js";
import type { Registration } from "./surface.js";
import { REGISTER, isSurface, valueOf } from "./surface.js";
import { buildBound, buildDeferred } from "./builders.js";

// The op body behind every `.extend()` method and this module's free
// function — one definition of what "extend" does. Carries the REGISTER
// tag (paired with the `chain` brand) so buildDeferred applies the
// grown table without invoking it.
export const extendOp = Object.assign(
  (ops: OpMap): ((_data: unknown) => Registration) =>
    (_data: unknown) => ({ [REGISTER]: true, ops }),
  { [REGISTER]: true },
) as (ops: OpMap) => (_data: unknown) => Registration;

/**
 * Wires new ops onto a surface. Accepts a data op, or a factory
 * yielding one once applied.
 *
 * ```ts
 * import { pirell } from "@pirell/core";
 * import type { Op } from "@pirell/core";
 *
 * const double = (): Op<[["i", number]], [["i", number]]> => (ns) =>
 *   ns.map((n) => n * 2);
 * const $ = pirell().extend({ double });
 * $([1, 2]).double().value; // [2, 4]
 * ```
 *
 * Result types come from {@linkcode ExtendResult} — annotate composed
 * surfaces as `Extended<typeof ops>`.
 */
export function extend<S, Ops extends OpMap>(
  surface: S,
  ops: Ops,
): ExtendResult<S, Ops>;
export function extend<Ops extends OpMap>(
  ops: Ops,
): <S>(surface: S) => ExtendResult<S, Ops>;
// Data-op form only: a factory here would take the data as its argument
// and return a function. Reject function-typed results at the type level
// (re-checked at runtime for untyped callers).
export function extend<F extends (data: any) => unknown>(
  fn: F & (ReturnType<F> extends (...args: any[]) => any ? never : unknown),
): (x: any) => ReturnType<F>;
export function extend(surfaceOrOps: any, ops?: any): any {
  if (ops !== undefined) {
    return applyExtend(surfaceOrOps, ops);
  }
  if (typeof surfaceOrOps === "function") {
    // Surfaces are callable functions too — unwrap raw values first,
    // then run the op on them.
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
  if (!isSurface(surface)) {
    throw new TypeError(
      "extend(surface, ops): surface has no .extend() method — pass an assembled pirell() surface.",
    );
  }
  // A bare surface (ops: {}) has no `.extend` method yet — bootstrap
  // its table directly; everything else uses its real method, going
  // through the ordinary Registration/applyOp path.
  if (typeof surface.extend !== "function") {
    return surface.value === undefined
      ? buildDeferred([], ops)
      : buildBound(surface.value, ops);
  }
  return surface.extend(ops);
}
