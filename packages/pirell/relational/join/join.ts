import type { Op } from "@pirell/core";
import type { Db, Table } from "../types.js";
import { resolveKeyFns, resolveMatcher } from "./keys.js";
import { autoKey } from "./inference.js";
import type {
  JoinKeys,
  JoinKeyFn,
  JoinKind,
  JoinOptions,
  KeyFns,
  KeyResolver,
  Matcher,
  Row,
} from "./keys.js";

/**
 * Relational join. SQL row-multiplying semantics; flat merge
 * `{ ...left, ...right }`, right side wins collisions. Matched rows
 * emit in left order; unmatched right rows (`right`/`full`) emit in
 * right-table order after them.
 *
 * ```ts
 * pirell(
 *   [{order_id: 1, customer_id: 10 }]
 * ).join(
 *   [{ id: 10, name: "Ada" }],
 *   { on: ["customer_id", "id"] }
 * ).value;
 * // [{ order_id: 1, customer_id: 10, id: 10, name: "Ada" }]
 * ```
 *
 * @param right Right table.
 * @param options Strategy and key spec.
 */
export const join =
  <R, S>(right: S[], options?: JoinOptions<R, S>): Op<Table, Table> =>
  (data) => {
    // Seam: caller-typed factory rows vs shape-read op (see GroupKey seam).
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- caller-owned row contract
    const rightRows = right as unknown as Row[];
    return runJoin(
      data,
      rightRows,
      options?.join ?? "inner",
      () => options?.on,
      (rows) => rows,
    );
  };

/**
 * Joins two named tables of a db. Same semantics as {@linkcode join}
 * (row-multiplying, flat right-wins merge), but the tables are looked
 * up by name and the result replaces the left table in a copy of the
 * db — other tables ride along untouched, so named joins chain:
 *
 * ```ts
 * pirell(db)
 *   .joinDb("orders", "customers")
 *   .joinDb("orders", "products").orders.value;
 * ```
 *
 * Omitted `on` infers by name ({@linkcode autoKey}); explicit tuples,
 * resolvers, and per-pair functions behave as in {@linkcode join}.
 *
 * @param leftName Table to replace with the joined result.
 * @param rightName Table to join in (kept as-is).
 * @param options Strategy and key specification.
 */
export const joinDb =
  <R, S>(
    leftName: string,
    rightName: string,
    options?: JoinOptions<R, S>,
  ): Op<Db, Db> =>
  (data) => {
    const db: Record<string, unknown> = data;
    const leftRows = table(db, leftName);
    const rightRows = table(db, rightName);
    const kind = options?.join ?? "inner";

    // Omitted `on` infers by table name; explicit forms behave as in join.
    // Resolved lazily: empty sides and cross never reach key inference.
    return runJoin(
      leftRows,
      rightRows,
      kind,
      () =>
        options?.on ?? autoKey(leftName, rightName, leftRows[0], rightRows[0]),
      (rows) => ({ ...db, [leftName]: rows }),
    );
  };

// One skeleton for every join — empty exits, cross, then hash (O(n+m))
// or predicate (O(n·m)) paths. Sources and sinks vary; keys resolve
// lazily, after the exits.
const runJoin = <R, S, E>(
  leftRows: Row[],
  rightRows: Row[],
  kind: JoinKind,
  resolveKeys: () => JoinKeys | JoinKeyFn<R, S> | KeyResolver | undefined,
  emit: (rows: Row[]) => E,
): E => {
  const keepLeft = kind === "left" || kind === "full" || kind === "anti";
  const keepRight = kind === "right" || kind === "full";

  // Empty-side early exits, preserving unmatched semantics (anti with
  // an empty right keeps every left row — nothing to exclude).
  if (leftRows.length === 0) return emit(keepRight ? rightRows : []);
  if (rightRows.length === 0) return emit(keepLeft ? leftRows : []);

  if (kind === "cross")
    return emit(
      leftRows.flatMap((left) => rightRows.map((r) => ({ ...left, ...r }))),
    );

  const on = resolveKeys();
  const keyFns = resolveKeyFns(leftRows[0], rightRows[0], on);
  if (kind === "anti")
    return emit(
      keyFns
        ? antiJoin(leftRows, rightRows, keyFns)
        : antiScan(
            leftRows,
            rightRows,
            resolveMatcher(leftRows[0], rightRows[0], on),
          ),
    );
  if (keyFns)
    return emit(hashJoin(leftRows, rightRows, keyFns, keepLeft, keepRight));
  return emit(
    nestedJoin(
      leftRows,
      rightRows,
      resolveMatcher(leftRows[0], rightRows[0], on),
      keepLeft,
      keepRight,
    ),
  );
};

// Looks up a table by name. Missing names (and non-table values) throw
// rather than joining against undefined.
const table = (db: Record<string, unknown>, name: string): Row[] => {
  const rows: unknown = db[name];
  if (!Array.isArray(rows))
    throw new Error(`join: table '${name}' not found in db`);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- caller-owned table contract (see seam comment in join)
  return rows as Row[];
};

// Keyed loop over a right-side hash index. Perf: KeyFns closures cost
// ~1.15× direct reads at 280k rows; tuples carry the right index for
// right/full orphan tracking only when keepRight asks for it.
export const hashJoin = (
  data: Row[],
  rightRows: Row[],
  keys: KeyFns,
  keepLeft: boolean,
  keepRight: boolean,
): Row[] => {
  const [leftKey, rightKey] = keys;
  const index = new Map<unknown, Array<[Row, number]>>();
  for (const [i, r] of rightRows.entries()) {
    const k = rightKey(r);
    const bucket = index.get(k);
    if (bucket) bucket.push([r, i]);
    else index.set(k, [[r, i]]);
  }

  const seen = keepRight ? rightRows.map(() => false) : null;
  const out: Row[] = [];
  for (const left of data) {
    const bucket = index.get(leftKey(left));
    if (bucket) {
      for (const [r, i] of bucket) {
        out.push({ ...left, ...r });
        if (seen) seen[i] = true;
      }
    } else if (keepLeft) out.push(left);
  }

  if (seen) for (const [i, r] of rightRows.entries()) if (!seen[i]) out.push(r);

  return out;
};

// Left rows with no match, via a right-side key set. Unmerged and
// unduplicated — the anti half of the hash path.
const antiJoin = (data: Row[], rightRows: Row[], keys: KeyFns): Row[] => {
  const [leftKey, rightKey] = keys;
  const present = new Set<unknown>();
  for (const r of rightRows) present.add(rightKey(r));
  return data.filter((left) => !present.has(leftKey(left)));
};

// Left rows with no match, pairwise. The anti half of the predicate path.
const antiScan = (data: Row[], rightRows: Row[], matches: Matcher): Row[] =>
  data.filter((left) => !rightRows.some((r) => matches(left, r)));

// Pairwise loop for function matchers. Perf: pair predicates cost
// ~2.8× bare comparison per candidate (the user fn's pair alloc) plus
// ~1.2× matcher wrap — the escape hatch, priced accordingly; keyable
// specs route to the hash path instead.
export const nestedJoin = (
  data: Row[],
  rightRows: Row[],
  matches: Matcher,
  keepLeft: boolean,
  keepRight: boolean,
): Row[] => {
  const seen = keepRight ? rightRows.map(() => false) : null;
  const out: Row[] = [];
  for (const left of data) {
    let matched = false;
    for (const [i, r] of rightRows.entries()) {
      if (matches(left, r)) {
        matched = true;
        if (seen) seen[i] = true;
        out.push({ ...left, ...r });
      }
    }
    if (!matched && keepLeft) out.push(left);
  }

  if (seen) for (const [i, r] of rightRows.entries()) if (!seen[i]) out.push(r);

  return out;
};
