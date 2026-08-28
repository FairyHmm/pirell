import type { Op } from "./types.js";

// No T/R on Op: In/Out are the only source of truth. Each op narrows
// data.value to what it actually needs — the shape doesn't guarantee it.
export const double: Op<["i"], ["i"]> = (data) => ({
  value: (data.value as number[]).map((n) => n * 2),
});

export const sumAll: Op<["i"], []> = (data) => ({
  value: (data.value as number[]).reduce((a, b) => a + b, 0),
});

// Object shape ["k", ...] -> mixed-indexed ["i..."]:
// each entry is a [key, value] pair with non-uniform value structure.
// Input is ["k", "..."]: prefix match only (object may be deeper).
export const toEntries: Op<["k", "..."], ["i..."]> = (data) => ({
  value: Object.entries(data.value as Record<string, unknown>),
});

// Nested shape ["k", "i", ...] -> ["k"]: sums each array under a key.
// Input is ["k", "i", "..."]: prefix match only.
export const sumValues: Op<["k", "i", "..."], ["k"]> = (data) => ({
  value: Object.fromEntries(
    Object.entries(data.value as Record<string, number[]>).map(([k, v]) => [
      k,
      v.reduce((a, b) => a + b, 0),
    ]),
  ),
});

// Mixed-indexed ["i..."] -> ["i"]: strips keys, returns values only.
export const flattenEntries: Op<["i..."], ["i"]> = (data) => ({
  value: (data.value as [string, unknown][]).map(([, v]) => v),
});

// Mixed-keyed ["k..."]: object whose values are non-uniform
// (e.g. string/number/boolean). Stringifies all values to normalize.
export const stringifyValues: Op<["k..."], ["k"]> = (data) => ({
  value: Object.fromEntries(
    Object.entries(data.value as Record<string, unknown>).map(([k, v]) => [
      k,
      String(v),
    ]),
  ),
});
