/**
 * Column aggregations: `sum`, `avg`, `max`, `min`. Terminal folds —
 * each collapses to a `Scalar`, read via `.value`. Generic over any
 * indexed input.
 *
 * ```ts
 * import { pirell } from "@pirell/ops";
 *
 * pirell(orders).pluck("amount").sum().value; // 14
 * pirell(orders).avg("amount").value; // 4.666...
 * ```
 *
 * @module
 */
import type { Terminal } from "../fallthrough/array.js";
import type { PluckKey } from "./rows.js";
import { read } from "./methods.js";

/**
 * Totals the values. Non-numeric values (`null`, `undefined`, `NaN`,
 * non-numbers) are skipped, pandas-style; empty (or fully skipped)
 * input totals `0`.
 *
 * @param keyOrFn A field name, a projection over each element, or
 * nothing (sums the elements themselves).
 */
export const sum =
  (keyOrFn?: PluckKey): Terminal =>
  (data) => {
    const project = projectAgg(keyOrFn);
    let total = 0;
    for (const row of data) {
      const value = project(row);
      if (typeof value === "number" && !Number.isNaN(value)) total += value;
    }
    return total;
  };

/**
 * Averages the values under the same skip rule as {@linkcode sum};
 * empty input averages `NaN`.
 *
 * @param keyOrFn A field name, a projection over each element, or
 * nothing (averages the elements themselves).
 */
export const avg =
  (keyOrFn?: PluckKey): Terminal =>
  (data) => {
    const project = projectAgg(keyOrFn);
    let total = 0;
    let count = 0;
    for (const row of data) {
      const value = project(row);
      if (typeof value === "number" && !Number.isNaN(value)) {
        total += value;
        count += 1;
      }
    }
    return count === 0 ? NaN : total / count;
  };

/**
 * Returns the largest value (`<` / `>` comparison, as in sort —
 * strings compare code-unit). `null`/`undefined` are skipped; empty
 * input yields `undefined`, lodash-style.
 *
 * @param keyOrFn A field name, a projection over each element, or
 * nothing (maxes the elements themselves).
 */
export const max = (keyOrFn?: PluckKey): Terminal => extremum(keyOrFn, 1);

/**
 * Returns the smallest value, mirroring {@linkcode max}.
 *
 * @param keyOrFn A field name, a projection over each element, or
 * nothing (mins the elements themselves).
 */
export const min = (keyOrFn?: PluckKey): Terminal => extremum(keyOrFn, -1);

const projectAgg = (keyOrFn?: PluckKey): ((row: unknown) => unknown) =>
  keyOrFn === undefined
    ? (row) => row
    : typeof keyOrFn === "function"
      ? keyOrFn
      : (row) => read(row, keyOrFn);

// Shared extremum skeleton: direction picks the comparison.
const extremum =
  (keyOrFn: PluckKey | undefined, direction: 1 | -1): Terminal =>
  (data) => {
    const project = projectAgg(keyOrFn);
    let best: unknown;
    let found = false;
    for (const row of data) {
      const value = project(row);
      if (value === null || value === undefined) continue;
      if (!found || beats(value, best, direction)) {
        best = value;
        found = true;
      }
    }
    return best;
  };

// `<` / `>` over caller-typed values, as in sort.
const beats = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- comparands are caller-typed, as in sort
  value: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- comparands are caller-typed, as in sort
  best: any,
  direction: 1 | -1,
): boolean => (direction === 1 ? value > best : value < best);

/** Column aggregations, as data for `extend`. */
export const aggregateMethods = { sum, avg, max, min };
