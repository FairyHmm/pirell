import type { Op } from "./types.js";
import { op } from "./op.js";

// `data: unknown` is required — Op's generic call signature (see
// types.ts/shape-inference.md) doesn't contextually type plain arrows.
export const double: Op<["i"], ["i"]> = (data: unknown) =>
  (data as number[]).map((n) => n * 2);

export const sumAll: Op<["i"], []> = (data: unknown) =>
  (data as number[]).reduce((a, b) => a + b, 0);

// A [k,v] pair array's rows are uniform ("i") but each row's own
// contents vary ("i..."), not one flat mixed dimension.
export const toEntries: Op<["k"], ["i", "i..."]> = (data: unknown) =>
  Object.entries(data as Record<string, unknown>);

export const entriesToObject: Op<["i", "i..."], ["k"]> = (data: unknown) =>
  Object.fromEntries(data as [string, unknown][]);

// Prefix match: ShapeOf derives a uniform-array-valued object as
// ["k", "i"], which this open tail accepts.
export const sumValues: Op<["k", "i", "..."], ["k"]> = (data: unknown) =>
  Object.fromEntries(
    Object.entries(data as Record<string, number[]>).map(([k, v]) => [
      k,
      v.reduce((a, b) => a + b, 0),
    ]),
  );

export const flattenEntries: Op<["i", "i..."], ["i"]> = (data: unknown) =>
  (data as [string, unknown][]).map(([, v]) => v);

// Object whose values are genuinely non-uniform (string/number/boolean).
export const stringifyValues: Op<["k..."], ["k"]> = (data: unknown) =>
  Object.fromEntries(
    Object.entries(data as Record<string, unknown>).map(([k, v]) => [
      k,
      String(v),
    ]),
  );

// Non-empty-Args exercise for op()'s dual-form dispatcher (see BUGS.md
// #8 / archive/BUGS-fixed.md): data-first `nth(data, i)` or curried
// `nth(i)(data)`. `impl.length` (2) minus the data param gives arity 1,
// so op() dispatches on `callArgs.length === 1` to pick curried form.
export const nth: Op<["i"], [], [number]> = op(
  (data: unknown, i: number) => (data as unknown[])[i],
);
