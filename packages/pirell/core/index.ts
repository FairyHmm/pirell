/**
 * Shape-aware pipelines over JSON data: {@linkcode pirell} binds data
 * to a fluent surface, {@linkcode pipe} threads it through bare ops,
 * {@linkcode extend} wires new ops onto a surface. Shapes (`["i", "..."]`
 * columns, `["k", "..."]` records) are checked at each call; mismatches
 * fail to compile. Callers type values, the library owns shapes.
 *
 * @module
 */
export * from "./types/public.js";
export { pipe, compose } from "./entry/compose.js";
export { extend, type Extended } from "./entry/extend.js";
export { buildBound, buildDeferred } from "./entry/builders.js";
export { makeFlat, makeCurry } from "./ops/ops.js";
export { SURFACE, isSurface, valueOf } from "./entry/surface.js";

import { pirell as pirellRaw } from "./entry/pirell.js";
import { compose } from "./entry/compose.js";
import { extend, extendOp, type Extended } from "./entry/extend.js";

// The surface's own table: plain entries, wired by the generic arms
// (registration/threading) like any user-defined methods. Packages add
// their ops the same way.
export const coreOps = {
  pipe: compose,
  compose,
  extend: extendOp,
};

/** The ops map behind {@linkcode pirell}, as a type for composition. */
export type CoreOps = typeof coreOps;

/**
 * Binds data to a fluent surface: shape proven from the data, each
 * chained op checked against it, `.value` unwraps the result.
 * `pirell()` (no data) registers ops for later.
 */
export const pirell: Extended<CoreOps> = extend(pirellRaw(), coreOps);
