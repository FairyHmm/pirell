import type { Op } from "../types/base.js";

// Zero cast: Raw<S> = DataOf<S> & optional brand, so a prior op's output
// satisfies the next op's data param directly.

// Branch claim ([["i", number]]), not bare ["i"] — yet bare literals
// still need no cast.
export const double: Op<[["i", number]], [["i", number]]> =
  () => (data) => data.map((n) => n * 2);

export const sumAll: Op<[["i", number]], []> =
  () => (data) => data.reduce((a, b) => a + b, 0);

// [k,v] pair rows are uniform ("i") but row contents vary ("i...").
export const toEntries: Op<["k"], ["i", "i..."]> =
  () => (data) => Object.entries(data);

export const entriesToObject: Op<["i", "i..."], ["k"]> =
  () => (data) => Object.fromEntries(data);

// Inner arrays carry Branch number through to a uniform Record<string, number>.
export const sumValues: Op<["k", ["i", number], "..."], [["k", number]]> =
  () => (data) =>
    Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, v.reduce((a, b) => a + b, 0)]),
    );

export const flattenEntries: Op<["i", "i..."], ["i"]> =
  () => (data) => data.map(([, v]) => v);

// In is honestly non-uniform ("k..."); Out is uniform (String(v) is
// always string).
export const stringifyValues: Op<["k..."], [["k", string]]> =
  () => (data) =>
    Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]));

// Parameterized op: the argument lives in Op's own Args slot, exercising a
// parameterized op as a chain link.
export const nth: Op<["i"], [], [i: number]> =
  (i: number) => (data) => data[i];
