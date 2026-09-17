import type { Op } from "@pirell/core";
import type { Table } from "../types.js";
import { resolveKeyFns, resolveMatcher } from "./keys.js";
import type {
  JoinKeys,
  JoinKeyFn,
  KeyFns,
  KeyResolver,
  Matcher,
  Row,
} from "./keys.js";

/**
 * Keyed strategies take `on`; `cross` takes none (`on` with `cross` is a
 * type error; runtime callers see it ignored).
 */
export type JoinOptions<R, S> =
  | {
      /** Strategy; default `"inner"`. */
      join?: "inner" | "left" | "right" | "full";
      /** Explicit keys, a resolver (e.g. naturalKey), or per-pair projection. Omitted → natural key (single shared field). */
      on?: JoinKeys | JoinKeyFn<R, S> | KeyResolver;
    }
  | {
      /** Cartesian product. */
      join: "cross";
      on?: never;
    };

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
    const kind = options?.join ?? "inner";
    // Seam: caller-typed factory rows vs shape-read op (see GroupKey seam).
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- caller-owned row contract
    const rightRows = right as unknown as Row[];

    const keepLeft = kind === "left" || kind === "full";
    const keepRight = kind === "right" || kind === "full";

    // Empty-side early exits, preserving unmatched semantics.
    if (data.length === 0) return keepRight ? rightRows : [];
    if (rightRows.length === 0) return keepLeft ? data : [];

    if (kind === "cross")
      return data.flatMap((left) => rightRows.map((r) => ({ ...left, ...r })));

    // Hash path: keyable `on` indexes the right side once. O(n + m).
    const keyFns = resolveKeyFns(data[0], rightRows[0], options?.on);
    if (keyFns) return hashJoin(data, rightRows, keyFns, keepLeft, keepRight);

    // Predicate path: function matcher. O(n * m).
    const matches = resolveMatcher(data[0], rightRows[0], options?.on);
    return nestedJoin(data, rightRows, matches, keepLeft, keepRight);
  };

// Keyed loop over a right-side hash index.
const hashJoin = (
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

// Pairwise loop for function matchers.
const nestedJoin = (
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
