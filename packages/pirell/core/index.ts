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
 * The surface machinery lives in `entry/pirell.ts` (`pirellRaw`, bare,
 * no ops); this module defines "core ops" and builds `pirell` as
 * `extend(pirellRaw(), coreOps)` — the same public pieces any package
 * (like `@pirell/group`) composes its own surface from.
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

// coreOps states everything pirell() actually offers, extend included —
// nothing is seeded onto a surface for free (builders.ts: bare pirellRaw
// has zero methods). extendOp is the exact op body a surface's own
// `.extend()` dispatches to; including it here is what makes it exist,
// like any package adding it to its own map. pipe/compose are marked
// chains — var-args-fn ops that re-bind the surface (markChain, the
// type-level counterpart of markRegistering).
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
 *
 * pirell([1, 2]).value; // [1, 2]
 * pirell().each(Math.round); // deferred
 * ```
 */
export const pirell: Extended<CoreOps> = extend(pirellRaw(), coreOps);
