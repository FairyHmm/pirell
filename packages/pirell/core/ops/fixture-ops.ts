import type { Op } from "../types/types.js";

// Ops are always curried; the trailing `as Op<...>` cast supplies the
// required __pirell brand (BUGS.md #12), type-level only.
//
// double/sumAll's bodies genuinely depend on element type (arithmetic), so
// In/Out carry it via Branch: [["i", number]], not bare ["i"] — a real
// claim the op makes, not decoration (ARCHITECTURE.md: "Shape is a claim
// an Op's signature makes"). Bare-literal callers need no cast: ShapeOf<D>
// derives [["i", number]] directly from a number[] literal (non-union
// primitive leaf — shape-inference.md); data has no inherent shape, this
// is just what the literal's own static type already proves.
// impl's param is the real type (number[]), not unknown — no inner cast.
export const double = (() => (data: number[]) =>
  data.map((n) => n * 2)) as unknown as Op<[["i", number]], [["i", number]]>;

export const sumAll = (() => (data: number[]) =>
  data.reduce((a, b) => a + b, 0)) as unknown as Op<[["i", number]], []>;

// [k,v] pair rows are uniform ("i") but row contents vary ("i...").
export const toEntries = (() => (data: unknown) =>
  Object.entries(data as Record<string, unknown>)) as unknown as Op<
  ["k"],
  ["i", "i..."]
>;

export const entriesToObject = (() => (data: unknown) =>
  Object.fromEntries(data as [string, unknown][])) as unknown as Op<
  ["i", "i..."],
  ["k"]
>;

// Body reduces each value array numerically: In's inner array carries
// Branch number (not bare "i"), and Out carries it too — the result is
// Record<string, number>, uniformly, not an unconstrained keyed object.
export const sumValues = (() => (data: Record<string, number[]>) =>
  Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, v.reduce((a, b) => a + b, 0)]),
  )) as unknown as Op<["k", ["i", number], "..."], [["k", number]]>;

export const flattenEntries = (() => (data: unknown) =>
  (data as [string, unknown][]).map(([, v]) => v)) as unknown as Op<
  ["i", "i..."],
  ["i"]
>;

// In is genuinely non-uniform (values can be string/number/boolean/etc,
// "k..." is honest there). Out is uniform, though: String(v) always
// produces a string regardless of v's type, so the result is
// Record<string, string> — Out carries that even though In can't.
export const stringifyValues = (() => (data: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, String(v)]),
  )) as unknown as Op<["k..."], [["k", string]]>;

// Parameterized op: the argument lives in Op's own Args slot, exercising a
// parameterized op as a chain link.
export const nth = ((i: number) => (data: unknown) =>
  (data as unknown[])[i] as any) as unknown as Op<["i"], [], [i: number]>;
