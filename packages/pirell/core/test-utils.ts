import type { Continued, Mixed, Pirell as PirellT } from "./types.js";
import { defineOp } from "./types.js";

export const double = (data: PirellT<any, number[]>) => ({
  shape: data.shape,
  value: data.value.map((n: number) => n * 2),
});

export const sumAll = (data: PirellT<any, number[]>) => ({
  shape: [] as const,
  value: data.value.reduce((a: number, b: number) => a + b, 0),
});

// Object shape ['k', ...] -> mixed-indexed ['i...']: each entry is a [key, value]
// pair with non-uniform value structure, so output is Mixed<'i'>.
// Input is Continued<['k']>: prefix match only (object may be deeper).
export const toEntries = defineOp({
  in: ["k"] as unknown as Continued<["k"]>,
  out: [{ __mixed: "i" as const, __variants: [] as const }] as [Mixed<"i">],
  run: (data: PirellT<Continued<["k"]>, Record<string, unknown>>) => ({
    shape: [{ __mixed: "i" as const, __variants: [] as const }] as [Mixed<"i">],
    value: Object.entries(data.value) as [string, unknown][],
  }),
});

// Nested shape ['k', 'i', ...] -> ['k', ...]: sums each array under a key.
// Input is Continued<['k', 'i']>: prefix match only.
export const sumValues = defineOp({
  in: ["k", "i"] as unknown as Continued<["k", "i"]>,
  out: ["k"] as const,
  run: (data: PirellT<Continued<["k", "i"]>, Record<string, number[]>>) => ({
    shape: ["k"] as const,
    value: Object.fromEntries(
      Object.entries(data.value).map(([k, v]) => [
        k,
        v.reduce((a, b) => a + b, 0),
      ]),
    ),
  }),
});

// Mixed-indexed ['i...'] -> ['i']: strips keys, returns values only.
export const flattenEntries = defineOp({
  in: [{ __mixed: "i" as const, __variants: [] as const }] as [Mixed<"i">],
  out: ["i"] as const,
  run: (data: PirellT<[Mixed<"i">], [string, unknown][]>) => ({
    shape: ["i"] as const,
    value: data.value.map(([, v]) => v),
  }),
});

// Mixed-keyed ['k...']: object whose values are non-uniform (e.g. string/number/boolean).
// Stringifies all values to normalize — exercises Mixed<'k'> in op.in.
export const stringifyValues = defineOp({
  in: [{ __mixed: "k" as const, __variants: [] as const }] as [Mixed<"k">],
  out: ["k"] as const,
  run: (data: PirellT<[Mixed<"k">], Record<string, unknown>>) => ({
    shape: ["k"] as const,
    value: Object.fromEntries(
      Object.entries(data.value).map(([k, v]) => [k, String(v)]),
    ),
  }),
});
