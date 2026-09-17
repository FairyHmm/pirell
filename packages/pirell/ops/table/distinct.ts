/**
 * Row dedupe: by key(s) or whole row. Generic over any indexed input.
 *
 * ```ts
 * import { pirell } from "@pirell/ops";
 *
 * pirell(orders).distinct("status").value;
 * ```
 *
 * @module
 */
import type { Rewrap } from "../fallthrough/array.js";
import { read } from "./methods.js";

/** Dedupe key: a field name, field names, or a projection (caller-typed). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- row type is caller-supplied, see doc comment above
export type DistinctKey = string | string[] | ((row: any) => unknown);

/**
 * Drops duplicate elements, keeping first occurrences.
 *
 * Whole-row comparison considers all keys without depending on
 * insertion order. Nested values use reference equality.
 *
 * @param key A field name, field names, or a function projecting the
 * compared value from each row; omitted compares whole rows.
 */
export const distinct = (key?: DistinctKey): Rewrap => {
  if (key === undefined)
    return (data) => {
      const seen = new Set<string>();
      const refs = new Map<object, number>();
      return data.filter((row) => {
        const sig = rowSignature(row, refs);
        if (seen.has(sig)) return false;
        seen.add(sig);
        return true;
      });
    };
  const project = projectKey(key);
  return (data) => {
    const seen = new Set<string>();
    const refs = new Map<object, number>();
    return data.filter((row) => {
      const sig = valueSignature(project(row), refs);
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    });
  };
};

const projectKey = (key: DistinctKey): ((row: unknown) => unknown) => {
  if (typeof key === "function") return key;
  if (Array.isArray(key)) return (row) => key.map((k) => read(row, k));
  return (row) => read(row, key);
};

// Primitives by value; objects by identity (the nested rule).
const signature = (value: unknown, refs: Map<object, number>): string => {
  if (typeof value !== "object" || value === null)
    return `${typeof value}:${String(value)}`;
  const known = refs.get(value);
  if (known !== undefined) return `#${known}`;
  const id = refs.size;
  refs.set(value, id);
  return `#${id}`;
};

// Projected values: tuples compare element-wise.
const valueSignature = (value: unknown, refs: Map<object, number>): string =>
  Array.isArray(value)
    ? `[${value.map((item) => signature(item, refs)).join(",")}]`
    : signature(value, refs);

// Whole rows: top-level keys in sorted order, values by signature.
const rowSignature = (row: unknown, refs: Map<object, number>): string => {
  if (typeof row !== "object" || row === null || Array.isArray(row))
    return valueSignature(row, refs);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- caller-owned row contract (see fields.js)
  const rec = row as Record<string, unknown>;
  return `{${Object.keys(rec)
    .sort()
    .map((k) => `${k}:${signature(rec[k], refs)}`)
    .join(",")}}`;
};
