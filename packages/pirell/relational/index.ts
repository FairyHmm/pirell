/**
 * Relational operations for pirell pipelines: `join` and `joinDb`,
 * on top of every `@pirell/ops` op.
 *
 * ```ts
 * import { pirell } from "@pirell/relational";
 *
 * pirell(orders).sort("amount").join(customers, { on: ["customer_id", "id"] }).value;
 * ```
 *
 * Method sets live in {@linkcode relationalMethods}; every op is also
 * exported standalone for `pipe` from `@pirell/core`.
 *
 * @module
 */
import { pirell as pirellOps } from "@pirell/ops";
import type { CoreOps, Extended } from "@pirell/core";
import type { Ops } from "@pirell/ops";
import { join, joinDb } from "./join/join.js";

export type { Scalar, Column, Db, Row, Table } from "./types.js";
export * from "./join/join.js";
export * from "./join/keys.js";
export * from "./join/inference.js";

/**
 * Every op on the surface, as data for `extend`. Spread in your own ops
 * to compose a custom API — see {@linkcode Extended}.
 */
export const relationalMethods = {
  join,
  joinDb,
};
/** The ops map behind {@linkcode pirell}, as a type for composition. */
export type RelationalOps = typeof relationalMethods;
/** Data-bound entry: call with JSON data, chain ops, read `.value`. */
export const pirell: Extended<CoreOps & Ops & RelationalOps> =
  pirellOps.extend(relationalMethods);
