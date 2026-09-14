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
 * The surface machinery lives in `entry/pirell.ts` (bare, no ops);
 * this module is where "core ops" is defined — `{ pipe, compose, each }`,
 * added to the bare surface via `pirell().extend(coreOps)`, the same
 * way `@pirell/group` adds its ops.
 *
 * @module
 */
export * from "./types/public.js";
export { pipe, compose } from "./entry/compose.js";
export { Wrapper, bindValue } from "./entry/pirell.js";
export { extend } from "./entry/extend.js";
export { buildBound, buildDeferred } from "./entry/builders.js";
export { makeFlat, makeCurry } from "./ops/ops.js";
export { SURFACE, isSurface, valueOf } from "./entry/surface.js";
export { each } from "./entry/each.js";

import { pirell as pirellRaw } from "./entry/pirell.js";
import { compose } from "./entry/compose.js";
import { each } from "./entry/each.js";
import type { Extended, OpMap, BoundWith } from "./types/assembled.js";
import type { ShapeOf } from "./types/codec.js";

const coreOps: OpMap = { pipe: compose, compose, each };

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
export function pirell<T>(data: T): BoundWith<CoreOps, ShapeOf<T>>;
export function pirell(): Extended<CoreOps>;
export function pirell(...args: [unknown] | []): unknown {
  return args.length === 0
    ? pirellRaw().extend(coreOps)
    : pirellRaw(args[0]).extend(coreOps);
}
