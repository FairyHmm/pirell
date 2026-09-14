// Single definition of surface identity + unwrap. assemble.ts and
// extend.ts must agree here, or user-facing and internal handling of
// extend(fn)(pirell(data)) diverge.
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
