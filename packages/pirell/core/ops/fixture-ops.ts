import type { Op } from "../types/types.js";

// data: unknown required — Op's generic signature drops contextual typing
// (see shape-inference.md). Ops are always curried; the trailing `as Op<...>`
// cast supplies the required __pirell brand (BUGS.md #12), type-level only.
export const double = (() => (data: unknown) =>
  (data as number[]).map((n) => n * 2)) as unknown as Op<["i"], ["i"]>;

export const sumAll = (() => (data: unknown) =>
  (data as number[]).reduce((a, b) => a + b, 0)) as unknown as Op<["i"], []>;

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

// Prefix-matches the derived ["k","i"] for a uniform-array-valued object.
export const sumValues = (() => (data: unknown) =>
  Object.fromEntries(
    Object.entries(data as Record<string, number[]>).map(([k, v]) => [
      k,
      v.reduce((a, b) => a + b, 0),
    ]),
  )) as unknown as Op<["k", "i", "..."], ["k"]>;

export const flattenEntries = (() => (data: unknown) =>
  (data as [string, unknown][]).map(([, v]) => v)) as unknown as Op<
  ["i", "i..."],
  ["i"]
>;

// Object with genuinely non-uniform values (string/number/boolean).
export const stringifyValues = (() => (data: unknown) =>
  Object.fromEntries(
    Object.entries(data as Record<string, unknown>).map(([k, v]) => [
      k,
      String(v),
    ]),
  )) as unknown as Op<["k..."], ["k"]>;

// Parameterized op: the argument lives in Op's own Args slot, exercising a
// parameterized op as a chain link.
export const nth = ((i: number) => (data: unknown) =>
  (data as unknown[])[i] as any) as unknown as Op<["i"], [], [i: number]>;
