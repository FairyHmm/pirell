// Single definition of surface identity + unwrap; builders and extend
// agree here.
import { REGISTER } from "../types/base.js";
import type { Registration } from "../types/base.js";

/** Marker property identifying a pirell surface. */
export const SURFACE = "__pirell";

/** Answers whether a value is a pirell surface. */
export const isSurface = (x: unknown): x is Record<PropertyKey, unknown> =>
  x !== null &&
  x !== undefined &&
  (typeof x === "function" || typeof x === "object") &&
  SURFACE in x;

/** Unwraps a surface to its raw value; passes anything else through. */
export const valueOf = (x: unknown): unknown => (isSurface(x) ? x.value : x);

/** Answers whether an op's result is a registration, not data. */
export const isRegistration = (x: unknown): x is Registration =>
  x !== null && x !== undefined && typeof x === "object" && REGISTER in x;
