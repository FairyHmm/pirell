import type { Op } from "@pirell/core";
import type { Row, Table } from "@pirell/relational";

// groupBy partitions a Table into a Group of Tables, keyed by a field
// name or a key function. Rows missing the key land under "undefined".

// The key names a field, or projects one from the caller's own row
// type — Pirell only ever speaks shapes; row value types are the
// caller's business (simple data in, complex TS types discouraged).
export type GroupKey<R> = string | ((row: R) => string);

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

export const indexBy =
  <R>(key: GroupKey<R>): Op<Table, ["k", ...Row]> =>
  (data) => {
    // Last Row wins; terminal — no row-collection dimension retained.
    const out = Object.create(null) as Record<string, Record<string, unknown>>;
    for (const row of data) {
      const k = typeof key === "function" ? key(row as R) : row[key];
      out[String(k)] = row;
    }
    return out;
  };

export const groupingMethods = { groupBy, indexBy };
