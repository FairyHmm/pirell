/**
 * Standard operations for pirell pipelines: grouping (`groupBy`,
 * `indexBy`), row conveniences (`sort`, `distinct`, `take`, `pluck`,
 * plus the `filter`/`find`/`findLast`/`some`/`every` predicate
 * shorthands), the `each` broadcast combinator, plus the native
 * `Array`/`Object` fallthroughs.
 *
 * ```ts
 * import { pirell } from "@pirell/ops";
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
 * Method sets live in {@linkcode opsMethods} (`groupingMethods` +
 * `tableMethods` + `each` + `arrayFallthroughMethods` +
 * `objectFallthroughMethods`); every op is also exported standalone
 * for `pipe` from `@pirell/core`.
 *
 * @module
 */
import { pirell as pirellRaw } from "@pirell/core";
import type { CoreOps, Extended } from "@pirell/core";
import { groupingMethods } from "./grouping/groups.js";
import { tableMethods } from "./table/methods.js";
import { arrayFallthroughMethods } from "./fallthrough/array.js";
import { objectFallthroughMethods } from "./fallthrough/object.js";
import { each } from "./grouping/each.js";

export * from "./grouping/groups.js";
export * from "./grouping/each.js";
export * from "./table/rows.js";
export * from "./table/distinct.js";
export * from "./table/predicates.js";
export * from "./fallthrough/array.js";
export * from "./fallthrough/object.js";

/**
 * Every op on the surface, as data for `extend`: grouping plus row
 * conveniences plus `each` plus the array/object fallthroughs. Spread
 * in your own ops to compose a custom API — see {@linkcode Extended}.
 */
export const opsMethods = {
  ...groupingMethods,
  ...tableMethods,
  ...arrayFallthroughMethods,
  ...objectFallthroughMethods,
  each,
};
/** The ops map behind {@linkcode pirell}, as a type for composition. */
export type Ops = typeof opsMethods;
/**
 * Data-bound entry: call with JSON data, chain ops, read `.value`.
 *
 * ```ts
 * import { pirell } from "@pirell/ops";
 *
 * pirell([3, 1, 2]).sort().value; // [1, 2, 3]
 * ```
 */
export const pirell: Extended<CoreOps & Ops> =
  pirellRaw().extend(opsMethods);
