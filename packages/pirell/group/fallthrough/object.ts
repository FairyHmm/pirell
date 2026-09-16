/**
 * Native `Object` passthroughs for keyed data: unwrap a record with
 * {@linkcode keys}, {@linkcode values} or {@linkcode entries},
 * rebuild one with {@linkcode fromEntries}, merge with
 * {@linkcode assign}, probe with {@linkcode hasOwn}.
 *
 * Fallthrough contract: any keyed (`["k", "..."]`) input is accepted;
 * results rewrap as an open column or pair rows.
 *
 * ```ts
 * import { pirell } from "@pirell/group";
 *
 * pirell({ a: 1, b: 2 }).entries().value; // [["a", 1], ["b", 2]]
 * ```
 *
 * @module
 */
import type { Op } from "@pirell/core";
import type { Indexed } from "./array.js";

// Direct assignment replaces the `(data) => ...` wrapper.
/** Shape claim for keyed (record) data. */
export type Keyed = ["k", "..."];
/** Shape claim for key/value pair rows. */
export type Pairs = ["i", "i..."];

/** Lists a record's keys as an open column. */
export const keys: Op<Keyed, Indexed> = Object.keys;
/** Lists a record's values as an open column. */
export const values: Op<Keyed, Indexed> = Object.values;
/** Lists a record's entries as pair rows. */
export const entries: Op<Keyed, Pairs> = Object.entries;
/**
 * Rebuilds a record from pair rows — the inverse of {@linkcode entries}.
 *
 * ```ts
 * import { pirell } from "@pirell/group";
 *
 * pirell([["a", 1]]).fromEntries().value; // { a: 1 }
 * ```
 */
export const fromEntries: Op<Pairs, ["k"]> = Object.fromEntries;

/**
 * Merges sources into a copy — right-side sources win on key
 * collision, matching native `Object.assign` semantics. A factory:
 * takes the sources up front, unlike the direct assignments above.
 *
 * ```ts
 * import { pirell } from "@pirell/group";
 *
 * pirell({ a: 1 }).assign({ b: 2 }).value; // { a: 1, b: 2 }
 * ```
 *
 * @param sources Records to merge, left to right.
 */
export const assign =
  (...sources: Record<string, unknown>[]): Op<Keyed, Keyed> =>
  (data) => {
    // No Object.assign(...sources) — its rest overload returns any.
    const out: Record<string, unknown> = { ...data };
    for (const src of sources) Object.assign(out, src);
    return out;
  };

/**
 * Answers key presence — a terminal probe, scalar result, no rewrap
 * counterpart.
 *
 * @param key The key to look up.
 */
export const hasOwn =
  (key: string): Op<Keyed, []> =>
  (data) =>
    Object.hasOwn(data, key);

/** Object fallthroughs, as data for `extend`. */
export const objectFallthroughMethods = {
  keys,
  values,
  entries,
  fromEntries,
  assign,
  hasOwn,
};
