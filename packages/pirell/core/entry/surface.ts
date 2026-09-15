// Single definition of surface identity + unwrap. assemble.ts and
// extend.ts must agree here, or user-facing and internal handling of
// extend(fn)(pirell(data)) diverge.
import type { OpMap } from "../types/assembled.js";

/** Marker property identifying a pirell surface. */
export const SURFACE = "__pirell";

/** Answers whether a value is a pirell surface. */
export const isSurface = (x: unknown): boolean =>
  x != null &&
  (typeof x === "function" || typeof x === "object") &&
  SURFACE in (x as any);

/** Unwraps a surface to its raw value; passes anything else through. */
export const valueOf = (x: unknown): unknown =>
  isSurface(x) ? (x as any).value : x;

// extend's result grows the method table rather than producing data —
// invisible to Op<In,Out>'s Shape-typed Out (PLAN.md item 1). runOp
// detects it structurally, the same way it already detects factory
// results, so extend needs no name-based hatch in buildSurface.
/** Marker property identifying an extend-style registration result. */
export const REGISTER = Symbol("pirellRegister");

/** An op result that adds ops to the surface rather than new data. */
export type Registration = { readonly [REGISTER]: true; ops: OpMap };

/** Answers whether an op's result is a registration, not data. */
export const isRegistration = (x: unknown): x is Registration =>
  x != null && typeof x === "object" && REGISTER in (x as any);
