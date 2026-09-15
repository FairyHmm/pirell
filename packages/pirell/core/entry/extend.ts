import type { ExtendResult, OpMap } from "../types/assembled.js";
import {
  isSurface,
  makeRegistration,
  markRegistering,
  valueOf,
} from "./surface.js";
import { growBareSurface } from "./builders.js";

// The op body behind every surface's `.extend()` method (wired into
// coreOps in index.ts) and this module's standalone free function
// alike — one definition, so exactly one place knows what "extend"
// does. Its result grows the surface's method table instead of
// producing data (invisible to Op<In,Out>'s Shape-typed Out, PLAN.md
// item 1); markRegistering tags it so buildDeferred grows its table
// immediately (entry/builders.ts) instead of deferring it as a step.
export const extendOp = markRegistering(
  (ops: OpMap) => (_data: unknown) => makeRegistration(ops),
);

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
 * The surface param is typed `surface: S` (the bare surface, not
 * `Assembled<S>`) so inference runs on plain positions, not the
 * conditional returns. The result is
 * {@linkcode ExtendResult} — the same type `surface.extend(ops)`
 * itself returns.
 *
 * Published compositions annotate the result `Extended<typeof ops>`
 * (see `Extended`); shape checking fires at each op call, not at
 * registration.
 */
export function extend<S, Ops extends OpMap>(
  surface: S,
  ops: Ops,
): ExtendResult<S, Ops>;
export function extend<Ops extends OpMap>(
  ops: Ops,
): <S>(surface: S) => ExtendResult<S, Ops>;
// Data op only: a factory applied here would take the data as its key
// argument and hand back a function, so reject function-typed results
// at the type level (and re-check at runtime for untyped callers).
export function extend<F extends (data: any) => unknown>(
  fn: F & (ReturnType<F> extends (...args: any[]) => any ? never : unknown),
): (x: any) => ReturnType<F>;
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
  if (!isSurface(surface)) {
    throw new TypeError(
      "extend(surface, ops): surface has no .extend() method — pass an assembled pirell() surface.",
    );
  }
  // The first bare surface (pirellRaw(), ops: {}) has no `.extend`
  // method — nothing has seeded one, by design (builders.ts: no name
  // is privileged there). growBareSurface handles that bootstrap case;
  // everything else uses its real method, going through the ordinary
  // Registration/applyOp path like any other op.
  if (typeof surface.extend !== "function") {
    return growBareSurface(surface, ops);
  }
  return surface.extend(ops);
}
