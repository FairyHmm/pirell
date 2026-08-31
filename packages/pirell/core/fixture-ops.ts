import type { Op } from "./types.js";
import { op } from "./op.js";

// data: unknown required — Op's generic signature drops contextual typing
// for plain arrows (see shape-inference.md).
export const double: Op<["i"], ["i"]> = (data: unknown) =>
  (data as number[]).map((n) => n * 2);

export const sumAll: Op<["i"], []> = (data: unknown) =>
  (data as number[]).reduce((a, b) => a + b, 0);

// [k,v] pair rows are uniform ("i") but row contents vary ("i...").
export const toEntries: Op<["k"], ["i", "i..."]> = (data: unknown) =>
  Object.entries(data as Record<string, unknown>);

export const entriesToObject: Op<["i", "i..."], ["k"]> = (data: unknown) =>
  Object.fromEntries(data as [string, unknown][]);

// Prefix-matches the derived ["k","i"] for a uniform-array-valued object.
export const sumValues: Op<["k", "i", "..."], ["k"]> = (data: unknown) =>
  Object.fromEntries(
    Object.entries(data as Record<string, number[]>).map(([k, v]) => [
      k,
      v.reduce((a, b) => a + b, 0),
    ]),
  );

export const flattenEntries: Op<["i", "i..."], ["i"]> = (data: unknown) =>
  (data as [string, unknown][]).map(([, v]) => v);

// Object with genuinely non-uniform values (string/number/boolean).
export const stringifyValues: Op<["k..."], ["k"]> = (data: unknown) =>
  Object.fromEntries(
    Object.entries(data as Record<string, unknown>).map(([k, v]) => [
      k,
      String(v),
    ]),
  );

// Exercises op()'s dual-form dispatcher: nth(data, i) or nth(i)(data).
export const nth: Op<["i"], [], [number]> = op(
  (data: unknown, i: number) => (data as unknown[])[i],
);
