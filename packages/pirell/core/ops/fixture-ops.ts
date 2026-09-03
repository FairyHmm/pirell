import type { Op } from "../types/types.js";

// Zero cast: Raw<S> = DataOf<S> & optional brand (types.ts), so a prior
// op's output satisfies the next op's data param directly.

// double/sumAll claim element type via Branch ([["i", number]], not bare
// ["i"]) — a real claim, not decoration. Bare-literal callers need no
// cast: ShapeOf derives [["i", number]] from a number[] literal directly.
export const double: Op<[["i", number]], [["i", number]]> =
  () => (data) => data.map((n) => n * 2);

export const sumAll: Op<[["i", number]], []> =
  () => (data) => data.reduce((a, b) => a + b, 0);

// [k,v] pair rows are uniform ("i") but row contents vary ("i...").
export const toEntries: Op<["k"], ["i", "i..."]> =
  () => (data) => Object.entries(data);

export const entriesToObject: Op<["i", "i..."], ["k"]> =
  () => (data) => Object.fromEntries(data);

// Body reduces each value array numerically: In's inner array carries
// Branch number (not bare "i"), and Out carries it too — the result is
// Record<string, number>, uniformly, not an unconstrained keyed object.
export const sumValues: Op<["k", ["i", number], "..."], [["k", number]]> =
  () => (data) =>
    Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, v.reduce((a, b) => a + b, 0)]),
    );

export const flattenEntries: Op<["i", "i..."], ["i"]> =
  () => (data) => data.map(([, v]) => v);

// In is genuinely non-uniform (values can be string/number/boolean/etc,
// "k..." is honest there). Out is uniform, though: String(v) always
// produces a string regardless of v's type, so the result is
// Record<string, string> — Out carries that even though In can't.
export const stringifyValues: Op<["k..."], [["k", string]]> =
  () => (data) =>
    Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]));

// Parameterized op: the argument lives in Op's own Args slot, exercising a
// parameterized op as a chain link.
export const nth: Op<["i"], [], [i: number]> =
  (i: number) => (data) => data[i];
