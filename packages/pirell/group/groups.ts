import type { Op } from "@pirell/core";
import type { Row, Table } from "@pirell/relational";

/**
 * Names the group key: a field name, or a projection over the
 * caller's own row type. Pirell only ever speaks shapes; row value
 * types are the caller's business.
 */
export type GroupKey<R> = string | ((row: R) => string);

/**
 * Partitions a table into a record of tables, keyed by a field name
 * or key function. Rows missing the key land under `"undefined"`.
 *
 * ```ts
 * import { pirell } from "@pirell/group";
 *
 * pirell([
 *   { status: "paid", amount: 5 },
 *   { status: "unpaid", amount: 2 },
 * ]).groupBy("status").value;
 * // { paid: [{ status: "paid", amount: 5 }], unpaid: [...] }
 * ```
 *
 * @param key A field name, or a function projecting one from each row.
 */
export const groupBy =
  <R>(key: GroupKey<R>): Op<Table, ["k", ...Table]> =>
  (data) =>
    // Delegates to native Object.groupBy (null-prototype result, own-key
    // safe, same String(undefined) coercion for a missing field — all
    // verified to match this op's prior manual-loop behavior). The
    // convenience layer is just the field-name/key-fn shorthand below;
    // the grouping itself is the native engine's job.
    Object.groupBy(data, (row) =>
      // Seam: the op holds shape-described rows; the fn holds caller
      // rows. The caller promised the projection fits their data.
      String(typeof key === "function" ? key(row as R) : row[key]),
    ) as Record<string, Record<string, unknown>[]>;

/**
 * Indexes a table into a record of single rows, keyed by a field
 * name or key function. Last row wins on key collision.
 *
 * ```ts
 * import { pirell } from "@pirell/group";
 *
 * pirell([
 *   { id: "a", amount: 5 },
 *   { id: "b", amount: 2 },
 * ]).indexBy("id").value;
 * // { a: { id: "a", amount: 5 }, b: { id: "b", amount: 2 } }
 * ```
 *
 * @param key A field name, or a function projecting one from each row.
 */
export const indexBy =
  <R>(key: GroupKey<R>): Op<Table, ["k", ...Row]> =>
  (data) => {
    const out = Object.create(null) as Record<string, Record<string, unknown>>;
    for (const row of data) {
      const k = typeof key === "function" ? key(row as R) : row[key];
      out[String(k)] = row;
    }
    return out;
  };

/**Grouping ops, as data for `extend`. */
export const groupingMethods = { groupBy, indexBy };
