import type { Pirell as PirellT } from "./types.js";
import { defineOp } from "./types.js";

export const double = (data: PirellT<any, number[]>) => ({
  shape: data.shape,
  value: data.value.map((n: number) => n * 2),
});

export const sumAll = (data: PirellT<any, number[]>) => ({
  shape: [] as const,
  value: data.value.reduce((a: number, b: number) => a + b, 0),
});

// Object shape ['k', ...] -> ['i', ...] (mixed: each entry is a [key, value]
// pair, and value's structure is whatever it is — not uniform across entries
// in general, so this is an "i..." mixed array, not a solid wrapped stack)
export const toEntries = defineOp({
  in: ["k"] as const,
  out: ["i"] as const,
  run: (data: PirellT<["k"], Record<string, unknown>>) => ({
    shape: ["i"] as const,
    value: Object.entries(data.value) as [string, unknown][],
  }),
});

// Nested shape ['k', 'i', ...] -> ['k', ...]
export const sumValues = defineOp({
  in: ["k", "i"] as const,
  out: ["k"] as const,
  run: (data: PirellT<["k", "i"], Record<string, number[]>>) => ({
    shape: ["k"] as const,
    value: Object.fromEntries(
      Object.entries(data.value).map(([k, v]) => [
        k,
        v.reduce((a, b) => a + b, 0),
      ]),
    ),
  }),
});

// Mixed entries shape ['i', ...] -> ['i', ...]
export const flattenEntries = defineOp({
  in: ["i"] as const,
  out: ["i"] as const,
  run: (data: PirellT<["i"], [string, unknown][]>) => ({
    shape: ["i"] as const,
    value: data.value.map(([, v]) => v),
  }),
});
