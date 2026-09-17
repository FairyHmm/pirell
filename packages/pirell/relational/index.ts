/**
 * Relational operations for pirell pipelines: `join` today; single-table
 * transforms (`sort`, `distinct`, `take`) and `pluck` to follow in
 * `table/`.
 *
 * ```ts
 * import { pirell } from "@pirell/relational";
 *
 * pirell(orders).join(customers, { on: ["customer_id", "id"] }).value;
 * ```
 *
 * Method sets live in {@linkcode relationalMethods}; every op is also
 * exported standalone for `pipe` from `@pirell/core`.
 *
 * @module
 */
import { pirell as pirellRaw } from "@pirell/core";
import type { CoreOps, Extended } from "@pirell/core";
import { join } from "./join/join.js";

export type { Scalar, Column, Row, Table } from "./types.js";
export * from "./join/join.js";
export * from "./join/keys.js";

/**
 * Every op on the surface, as data for `extend`. Spread in your own ops
 * to compose a custom API — see {@linkcode Extended}.
 */
export const relationalMethods = {
  join,
};
/** The ops map behind {@linkcode pirell}, as a type for composition. */
export type RelationalOps = typeof relationalMethods;
/** Data-bound entry: call with JSON data, chain ops, read `.value`. */
export const pirell: Extended<CoreOps & RelationalOps> =
  pirellRaw().extend(relationalMethods);
