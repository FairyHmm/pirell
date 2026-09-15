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
export { pipe, compose, markChain } from "./entry/compose.js";
export { extend } from "./entry/extend.js";
export { buildBound, buildDeferred } from "./entry/builders.js";
export { makeFlat, makeCurry } from "./ops/ops.js";
export { SURFACE, isSurface, valueOf } from "./entry/surface.js";
export { each } from "./entry/each.js";

import { pirell as pirellRaw } from "./entry/pirell.js";
import { compose, markChain } from "./entry/compose.js";
import { each } from "./entry/each.js";
import { extend, extendOp } from "./entry/extend.js";
import type { Extended } from "./types/assembled.js";

// Everything `pirell` offers, seeded via extend like any package's own
// map — pipe/compose are marked chains ({@linkcode markChain}).
export const coreOps = {
  pipe: markChain(compose),
  compose: markChain(compose),
  each,
  extend: extendOp,
};

/** The ops map behind {@linkcode pirell}, as a type for composition. */
export type CoreOps = typeof coreOps;

/**
 * Binds data to a fluent surface: shape proven from the data, each
 * chained op checked against it, `.value` unwraps the result.
 * `pirell()` (no data) registers ops for later.
 *
 * ```ts
 * import { pirell } from "@pirell/core";
 * import type { Op } from "@pirell/core";
 *
 * const double: Op<[["i", number]], [["i", number]]> = (ns) =>
 *   ns.map((n) => n * 2);
 * pirell([1, 2]).value; // [1, 2]
 * pirell().extend({ double }); // deferred: wire ops, bind data later
 * ```
 */
export const pirell: Extended<CoreOps> = extend(pirellRaw(), coreOps);
