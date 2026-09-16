import type { Deferred, OpMap, Shape } from "../types/base.js";
import type {
  Assembled,
  ResolvedOpsDeferred,
  SpecialOp,
} from "../types/wrapper.js";
import type { Registration } from "./surface.js";
import { REGISTER, isSurface, valueOf } from "./surface.js";
import { buildBound, buildDeferred } from "./builders.js";

// The op body behind every `.extend()`: REGISTER runtime tag plus the
// `reg` type brand routing surface calls to the table-merge wiring.
export const extendOp = Object.assign(
  (ops: OpMap): ((_data: unknown) => Registration) =>
    (_data: unknown) => ({ [REGISTER]: true, ops }),
  { [REGISTER]: true },
) as SpecialOp<"reg", (ops: OpMap) => (_data: unknown) => Registration>;

// extend's registry entry beside its owner (compare `chain` in
// compose.ts) — never from the types pile.
declare global {
  interface PirellSpecialWire<S, Ops extends OpMap> {
    /** extend: merge an ops map into the surface's table. */
    reg: <O2 extends OpMap>(ops: O2) => GrownSurface<S, O2 & Ops>;
  }
}

/**
 * Table-grow landing: deferred rebuilds with the merged table (its
 * call signatures capture it); bound keeps itself via `& S`.
 */
export type GrownSurface<S, Ops extends OpMap> =
  S extends Deferred<infer Out extends Shape>
    ? Assembled<ResolvedOpsDeferred<Out, Ops>, Ops> & {
        (): GrownSurface<S, Ops>;
      }
    : Assembled<S, Ops>;

/**
 * The common composition: ops wired onto a deferred surface. Annotate
 * published compositions as `Extended<typeof ops>`.
 *
 * ```ts
 * import { pirell } from "@pirell/core";
 * import type { Extended, Op } from "@pirell/core";
 *
 * const ops = {
 *   double: (): Op<[["i", number]], [["i", number]]> => (ns) =>
 *     ns.map((n) => n * 2),
 * };
 * const $: Extended<typeof ops> = pirell().extend(ops);
 * $([1, 2]).double().value; // [2, 4]
 * ```
 */
export type Extended<Ops extends OpMap> = GrownSurface<Deferred<[]>, Ops> & {
  (): GrownSurface<Deferred<[]>, Ops>;
};

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
 * Result types come from {@linkcode GrownSurface} — annotate composed
 * surfaces as `Extended<typeof ops>`.
 */
export function extend<S, Ops extends OpMap>(
  surface: S,
  ops: Ops,
): GrownSurface<S, Ops>;
export function extend<Ops extends OpMap>(
  ops: Ops,
): <S>(surface: S) => GrownSurface<S, Ops>;
// Data-op form only: a factory here would take the data as its argument
// and return a function. Reject function-typed results at the type level
// (re-checked at runtime for untyped callers).
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- accepts arbitrary user functions; (data: unknown) would reject typed params by contravariance
export function extend<F extends (data: any) => unknown>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- detects function-returning functions; must match any signature, unknown would miss typed ones
  fn: F & (ReturnType<F> extends (...args: any[]) => any ? never : unknown),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- single-stage op receives untyped data; the claim is checked at the call, not here
): (x: any) => ReturnType<F>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- implementation signature must stay any-compatible with all overloads; unknown would force casts throughout the body
export function extend(surfaceOrOps: any, ops?: OpMap): any {
  if (ops !== undefined) {
    return applyExtend(surfaceOrOps, ops);
  }
  if (typeof surfaceOrOps === "function") {
    // Surfaces are callable functions too — unwrap raw values first,
    // then run the op on them.
    return (surfaceOrValue: unknown) => {
      const raw = valueOf(surfaceOrValue);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment -- the op's own params are the caller's (structural, see the data-op overload); raw is the untrusted input that op is contractually equipped to read
      const out = surfaceOrOps(raw);
      if (typeof out === "function") {
        throw new TypeError(
          "extend(fn): fn returned a function — parameterized ops aren't supported by this form (the data was taken as the op's argument). Wire it via extend(surface, { name: fn }) instead, or pre-apply the argument: extend(fn(arg)).",
        );
      }
      return out as unknown;
    };
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- the one-arg ops-map form: surfaceOrOps here is the same map the OpMap annotation of the bootstrap branch statically knows
  return (surface: unknown) => applyExtend(surface, surfaceOrOps);
}

// Dynamic dispatch over surfaces of any kind; isSurface validates
// inside, and the resulting surface's exact shape depends on S/Ops.
function applyExtend(surface: unknown, ops: OpMap): unknown {
  if (!isSurface(surface)) {
    throw new TypeError(
      "extend(surface, ops): surface has no .extend() method — pass an assembled pirell() surface.",
    );
  }
  // A bare surface (ops: {}) has no `.extend` method yet — bootstrap
  // its table directly; everything else uses its real method, going
  // through the ordinary Registration/applyOp path.
  if (!canExtend(surface)) {
    return surface.value === undefined
      ? buildDeferred([], ops)
      : buildBound(surface.value, ops);
  }
  return surface.extend(ops);
}

// The runtime `typeof extend === "function"` check doubles as the
// shape predicate: every surface with an `.extend` member implements
// the ordinary extend(ops) → surface signature.
function canExtend(surface: Record<PropertyKey, unknown>): surface is Record<
  PropertyKey,
  unknown
> & {
  extend: (ops: OpMap) => unknown;
} {
  return typeof surface.extend === "function";
}
