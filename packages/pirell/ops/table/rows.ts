/**
 * Small row conveniences: `sort`, `take`, `pluck`. Generic over any
 * indexed input.
 *
 * ```ts
 * import { pirell } from "@pirell/ops";
 *
 * pirell(orders).sort("amount").take(2).pluck("status").value;
 * ```
 *
 * @module
 */
import type { Rewrap } from "../fallthrough/array.js";
import { read } from "./methods.js";

/** Sort key: a field name, or an ordering function (caller-typed). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- comparand type is caller-supplied, see doc comment above
export type SortKey = string | ((a: any, b: any) => number);

/**
 * Sorts a copy — never mutates the input.
 *
 * ```ts
 * import { pirell } from "@pirell/ops";
 *
 * pirell(orders).sort("amount").value;
 * pirell([3, 1, 2]).sort().value; // [1, 2, 3]
 * ```
 *
 * @param keyOrCompare A field name, an ordering function, or nothing
 * (elements sort by string conversion, native). Key values compare
 * with `<` / `>` (numeric for numbers, code-unit for strings);
 * incomparable pairs keep input order.
 */
export const sort =
  (keyOrCompare?: SortKey): Rewrap =>
  (data) =>
    typeof keyOrCompare === "string"
      ? data.toSorted(compareBy(keyOrCompare))
      : data.toSorted(keyOrCompare);

// Seam: the op holds shape-described rows; the key names a field the
// caller promises exists.
const compareBy =
  (key: string) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- caller-owned row contract (see seam comment)
  (a: any, b: any): number => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- caller-owned row contract (see seam comment)
    const left = a?.[key];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- caller-owned row contract (see seam comment)
    const right = b?.[key];
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  };

/**
 * Takes the first `n` elements, as a copy. Non-positive `n` yields
 * `[]`; overshoot yields the whole input.
 */
export const take =
  (n: number): Rewrap =>
  (data) =>
    n <= 0 ? [] : data.slice(0, n);

/** Projection: a field name, or a function over the row (caller-typed). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- row type is caller-supplied, see doc comment above
export type PluckKey = string | ((row: any) => unknown);

/**
 * Projects each element to a value, staying an open column.
 *
 * ```ts
 * import { pirell } from "@pirell/ops";
 *
 * pirell(orders).pluck("amount").value; // [5, 7, 2]
 * ```
 *
 * @param keyOrFn A field name, or a projection over each element.
 */
export const pluck =
  (keyOrFn: PluckKey): Rewrap =>
  (data) =>
    data.map(
      typeof keyOrFn === "function" ? keyOrFn : (row) => read(row, keyOrFn),
    );
