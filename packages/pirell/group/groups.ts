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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- groupBy yields every input row under some key; the Partial record fully materializes, so the claim is the op's real contract
    Object.groupBy(data, project(key)) as Record<
      string,
      Record<string, unknown>[]
    >;

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
    // Same null-prototype result as native groupBy; own-key safe.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Object.create(null) is lib-typed any; the claim captures the real shape
    const out = Object.create(null) as Record<string, Record<string, unknown>>;
    const dispose = project(key);
    for (const row of data) out[dispose(row)] = row;
    return out;
  };

// Seam: the op holds shape-described rows; the public key() is the
// caller's projection over their own row type. The caller promised the
// projection fits their data, so the claim below is the contract.
const project = <R>(
  key: GroupKey<R>,
): ((row: Record<string, unknown>) => string) =>
  (row) =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the caller-owned row contract (see seam comment)
    String(typeof key === "function" ? key(row as R) : row[key]);

/**Grouping ops, as data for `extend`. */
export const groupingMethods = { groupBy, indexBy };
