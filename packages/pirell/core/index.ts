/**
 * Shape-aware pipelines over JSON data: {@linkcode pirell} binds data
 * to a fluent surface, {@linkcode pipe} threads it through bare ops,
 * {@linkcode extend} wires new ops onto a surface.
 *
 * ```ts
 * import { pirell } from "@pirell/core";
 *
 * pirell([3, 1, 2]).value; // [3, 1, 2]
 * ```
 *
 * Shapes (`["i", "..."]` columns, `["k", "..."]` records) are checked
 * at each call; mismatches fail to compile. Callers type values, the
 * library owns shapes.
 *
 * @module
 */
export * from "./types/public.js";
export { pipe, compose } from "./entry/compose.js";
export { Wrapper } from "./entry/pirell.js";
export { pirell } from "./entry/assemble.js";
export { extend } from "./entry/extend.js";
export { makeFlat, makeCurry } from "./ops/ops.js";
export { SURFACE, isSurface, valueOf } from "./entry/surface.js";
