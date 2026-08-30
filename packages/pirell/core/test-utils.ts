import type { Op } from "./types.js";

// No T/R on Op: In/Out are the only source of truth. Each op narrows
// data (cast from the phantom Raw<In>) to what it actually needs — the
// shape doesn't guarantee it at runtime. All zero-arg here, so Op
// collapses to a single plain signature (see types.ts) — plain
// functions assign directly, no op() factory needed.
export const double: Op<["i"], ["i"]> = (data) =>
  (data as number[]).map((n) => n * 2);

export const sumAll: Op<["i"], []> = (data) =>
  (data as number[]).reduce((a, b) => a + b, 0);

// Keyed object ["k"] -> mixed-indexed ["i..."]:
// each entry is a [key, value] pair with non-uniform value structure.
export const toEntries: Op<["k"], ["i..."]> = (data) =>
  Object.entries(data as Record<string, unknown>);

// ["i..."] -> ["k"]: convert pairs back to object
export const entriesToObject: Op<["i..."], ["k"]> = (data) =>
  Object.fromEntries(data as [string, unknown][]);

// Nested shape ["k", "i", ...] -> ["k"]: sums each array under a key.
// Input is ["k", "i", "..."]: prefix match only.
export const sumValues: Op<["k", "i", "..."], ["k"]> = (data) =>
  Object.fromEntries(
    Object.entries(data as Record<string, number[]>).map(([k, v]) => [
      k,
      v.reduce((a, b) => a + b, 0),
    ]),
  );

// Mixed-indexed ["i..."] -> ["i"]: strips keys, returns values only.
export const flattenEntries: Op<["i..."], ["i"]> = (data) =>
  (data as [string, unknown][]).map(([, v]) => v);

// Mixed-keyed ["k..."]: object whose values are non-uniform
// (e.g. string/number/boolean). Stringifies all values to normalize.
export const stringifyValues: Op<["k..."], ["k"]> = (data) =>
  Object.fromEntries(
    Object.entries(data as Record<string, unknown>).map(([k, v]) => [
      k,
      String(v),
    ]),
  );
