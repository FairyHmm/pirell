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

/** Builds a registration result — extend's op body returns this. */
export const makeRegistration = (ops: OpMap): Registration => ({
  [REGISTER]: true,
  ops,
});

/** Answers whether an op's result is a registration, not data. */
export const isRegistration = (x: unknown): x is Registration =>
  x != null && typeof x === "object" && REGISTER in (x as any);

// A deferred surface can't call an op on real data to see whether it
// yields a Registration (no data exists yet, and a zero-arg call is
// ambiguous with the data-op case runOp disambiguates). The op itself
// carries the marker instead, checked without invoking anything —
// structural, not name-based: any tagged op grows the table
// immediately, extend or a future registering op alike.
/** Tags an op (factory or direct) as one that always yields a Registration. */
export const markRegistering = <F extends OpLikeFn>(fn: F): F =>
  Object.assign(fn, { [REGISTER]: true });

type OpLikeFn = (...args: any[]) => unknown;

/** Answers whether an op is tagged as always yielding a Registration. */
export const isRegisteringOp = (fn: unknown): boolean =>
  typeof fn === "function" && REGISTER in (fn as any);
