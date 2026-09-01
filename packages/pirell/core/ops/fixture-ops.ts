import type { Op } from "../types/types.js";

// data: unknown required — Op's generic signature drops contextual typing
// for plain arrows (see shape-inference.md). All ops are curried, even
// zero-arg ones — Op is always (...args: Args) => (data) => Raw<Out>, and
// shapes come from the Op<In,Out,Args> annotation only (no makeCurry).
export const double: Op<["i"], ["i"]> = () => (data: unknown) =>
  (data as number[]).map((n) => n * 2);

export const sumAll: Op<["i"], []> = () => (data: unknown) =>
  (data as number[]).reduce((a, b) => a + b, 0);

// [k,v] pair rows are uniform ("i") but row contents vary ("i...").
export const toEntries: Op<["k"], ["i", "i..."]> = () => (data: unknown) =>
  Object.entries(data as Record<string, unknown>);

export const entriesToObject: Op<["i", "i..."], ["k"]> =
  () => (data: unknown) =>
    Object.fromEntries(data as [string, unknown][]);

// Prefix-matches the derived ["k","i"] for a uniform-array-valued object.
export const sumValues: Op<["k", "i", "..."], ["k"]> = () => (data: unknown) =>
  Object.fromEntries(
    Object.entries(data as Record<string, number[]>).map(([k, v]) => [
      k,
      v.reduce((a, b) => a + b, 0),
    ]),
  );

export const flattenEntries: Op<["i", "i..."], ["i"]> = () => (data: unknown) =>
  (data as [string, unknown][]).map(([, v]) => v);

// Object with genuinely non-uniform values (string/number/boolean).
export const stringifyValues: Op<["k..."], ["k"]> = () => (data: unknown) =>
  Object.fromEntries(
    Object.entries(data as Record<string, unknown>).map(([k, v]) => [
      k,
      String(v),
    ]),
  );

// Parameterized op: nth(i) is baked into Op's own Args slot, not a
// hand-rolled factory outside the type — exercises Args in a chain.
export const nth: Op<["i"], [], [i: number]> = (i: number) => (data: unknown) =>
  (data as unknown[])[i] as any;
