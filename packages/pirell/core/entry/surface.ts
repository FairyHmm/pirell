// Single definition of surface identity + unwrap; builders and extend
// agree here.
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

// Marks an op result that grows the method table rather than producing
// data; runOp/applyOp branch on it structurally (no name-based hatch).
/** Marker property identifying an extend-style registration result. */
export const REGISTER = Symbol("pirellRegister");

/** An op result that adds ops to the surface rather than new data. */
export type Registration = { readonly [REGISTER]: true; ops: OpMap };

/** Answers whether an op's result is a registration, not data. */
export const isRegistration = (x: unknown): x is Registration =>
  x != null && typeof x === "object" && REGISTER in (x as any);
