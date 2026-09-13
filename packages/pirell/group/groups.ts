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
  (data) => {
    const out = Object.create(null) as Record<
      string,
      Record<string, unknown>[]
    >;
    for (const row of data) {
      // Seam: the op holds shape-described rows; the fn holds caller
      // rows. The caller promised the projection fits their data.
      const k = typeof key === "function" ? key(row as R) : row[key];
      (out[String(k)] ??= []).push(row);
    }
    return out;
  };

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
