/**
 * Grouped data pipelines: {@linkcode pirell} bound with grouping plus
 * the native `Array`/`Object` fallthroughs.
 *
 * ```ts
 * import { pirell } from "@pirell/group";
 *
 * const totals = pirell([
 *   { status: "paid", amount: 5 },
 *   { status: "paid", amount: 7 },
 *   { status: "unpaid", amount: 2 },
 * ]).groupBy("status").values().flatMap((rows) => rows);
 *
 * totals.value; // all three rows, grouped then unwrapped
 * ```
 *
 * Method sets live in {@linkcode groupMethods} (`groupingMethods` +
 * `arrayFallthroughMethods` + `objectFallthroughMethods`); every op is
 * also exported standalone for `pipe` from `@pirell/core`.
 *
 * @module
 */
import { pirell as pirellRaw } from "@pirell/core";
import type { Extended } from "@pirell/core";
import { groupingMethods } from "./groups.js";
import { arrayFallthroughMethods } from "./fallthrough/array.js";
import { objectFallthroughMethods } from "./fallthrough/object.js";

export * from "./groups.js";
export * from "./fallthrough/array.js";
export * from "./fallthrough/object.js";

/**
 * Every op on the surface, as data for `extend`: grouping plus the
 * array/object fallthroughs. Spread in your own ops to compose a
 * custom API — see `Extended` from `@pirell/core`.
 */
export const groupMethods = {
  ...groupingMethods,
  ...arrayFallthroughMethods,
  ...objectFallthroughMethods,
};
// The deferred surface with the group ops re-wired. tsc verifies the
// match against .extend() at each build.
/** The ops map behind {@linkcode pirell}, as a type for composition. */
export type GroupOps = typeof groupMethods;
/**
 * Data-bound entry: call with JSON data, chain ops, read `.value`.
 *
 * ```ts
 * import { pirell } from "@pirell/group";
 *
 * pirell([3, 1, 2]).sort().value; // [1, 2, 3]
 * ```
 */
export const pirell: Extended<GroupOps> = pirellRaw().extend(groupMethods);
