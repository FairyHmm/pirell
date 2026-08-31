// Single definition of "what is a Pirell surface" and how to unwrap it.
// assemble.ts identifies surfaces to bind/reuse their value; extend.ts's
// single-op form unwraps a surface before calling fn. Both must agree, or
// a user-facing call like extend(fn)(pirell(data)) would diverge from the
// internal surface handling.

export const SURFACE = "__pirell";

export const isSurface = (x: unknown): boolean =>
  x != null &&
  (typeof x === "function" || typeof x === "object") &&
  SURFACE in (x as any);

export const valueOf = (x: unknown): unknown =>
  isSurface(x) ? (x as any).value : x;
