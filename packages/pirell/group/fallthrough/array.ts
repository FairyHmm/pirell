// Native Array passthroughs. Fallthrough contract: any indexed (["i",
// "..."]) input is accepted, and array-returning methods rewrap as an
// open ["i", "..."] column — the native implementation defines the real
// shape. Terminal methods collapse to Scalar; read the result via
// `.value` (matches the rest of the lib).

import type { Op } from "@pirell/core";

// The set speaks two shapes — rewraps and terminals — and its walkers
// all take (row, index); named once so each op below is a call site.
export type Indexed = ["i", "..."];
export type Rewrap = Op<Indexed, Indexed>;
export type Terminal = Op<Indexed, []>;
export type ArrayCallback = (row: any, index: number) => any;

// Each op forwards data straight to a native method; the : Rewrap /
// : Terminal annotation supplies the conversion (and the JSR-required
// explicit return type) — data arrives as unknown[] via Op's DataOf.
export const map =
  (fn: ArrayCallback): Rewrap =>
  (data) =>
    data.map(fn);

export const filter =
  (pred: ArrayCallback): Rewrap =>
  (data) =>
    data.filter(pred);

export const sort =
  (compare?: (a: any, b: any) => number): Rewrap =>
  (data) =>
    data.toSorted(compare);

export const slice =
  (start?: number, end?: number): Rewrap =>
  (data) =>
    data.slice(start, end);

export const flat =
  (depth?: number): Rewrap =>
  (data) =>
    data.flat(depth);

export const flatMap =
  (fn: ArrayCallback): Rewrap =>
  (data) =>
    data.flatMap(fn);

export const concat =
  (...items: any[]): Rewrap =>
  (data) =>
    data.concat(...items);

// Named for the operation, not the native call — matches `sort`, which
// also calls a `toX`-copy method (`toSorted`) under a plain-verb name.
export const reverse = (): Rewrap => (data) => data.toReversed();

// `with` is a reserved word, so the export is `with_`; the methods map
// renames the fluent method to `with`.
export const with_ =
  (index: number, value: any): Rewrap =>
  (data) =>
    data.with(index, value);

// Copy-safe splice — mutating `splice` itself is deliberately excluded.
export const toSpliced =
  (start: number, deleteCount?: number, ...items: any[]): Rewrap =>
  (data) =>
    data.toSpliced(start, deleteCount as number, ...items);

export const find =
  (pred: ArrayCallback): Terminal =>
  (data) =>
    data.find(pred);

export const findIndex =
  (pred: ArrayCallback): Terminal =>
  (data) =>
    data.findIndex(pred);

export const findLast =
  (pred: ArrayCallback): Terminal =>
  (data) =>
    data.findLast(pred);

export const findLastIndex =
  (pred: ArrayCallback): Terminal =>
  (data) =>
    data.findLastIndex(pred);

export const at =
  (index: number): Terminal =>
  (data) =>
    data.at(index);

// Renamed from native `join` — `@pirell/relational` owns `join` for
// relational table joins; this avoids the future name collision.
export const arrayJoin =
  (separator?: string): Terminal =>
  (data) =>
    data.join(separator);

export const some =
  (pred: ArrayCallback): Terminal =>
  (data) =>
    data.some(pred);

export const every =
  (pred: ArrayCallback): Terminal =>
  (data) =>
    data.every(pred);

export const indexOf =
  (value: any, fromIndex?: number): Terminal =>
  (data) =>
    data.indexOf(value, fromIndex);

export const lastIndexOf =
  (value: any, ...rest: [fromIndex?: number]): Terminal =>
  (data) => {
    // Explicit-undefined fromIndex coerces to 0 in native lastIndexOf —
    // keep the omitted form forwarding no second argument (as reduce).
    return rest.length === 0
      ? data.lastIndexOf(value)
      : data.lastIndexOf(value, rest[0]);
  };

export const includes =
  (value: any, fromIndex?: number): Terminal =>
  (data) =>
    data.includes(value, fromIndex);

export const length: Terminal = (data) => data.length;

export const reduce =
  (
    reducer: (acc: any, value: any, index: number) => any,
    ...rest: [initial?: any]
  ): Terminal =>
  (data) => {
    // Omitted vs explicit-undefined init differ in native reduce — keep
    // the no-init form forwarding no second argument at all.
    return rest.length === 0
      ? data.reduce(reducer)
      : data.reduce(reducer, rest[0]);
  };

export const reduceRight =
  (
    reducer: (acc: any, value: any, index: number) => any,
    ...rest: [initial?: any]
  ): Terminal =>
  (data) => {
    return rest.length === 0
      ? data.reduceRight(reducer)
      : data.reduceRight(reducer, rest[0]);
  };

// Method sets grouped by intent; the flat aggregate keeps group/index.ts
// wiring unchanged. Export order is the public-surface order.
export const arrayTransformMethods = {
  map,
  filter,
  sort,
  slice,
  flat,
  flatMap,
  concat,
  reverse,
  with: with_,
  toSpliced,
};

export const arrayLookupMethods = {
  find,
  findIndex,
  findLast,
  findLastIndex,
  at,
};

export const arrayTestMethods = {
  some,
  every,
  indexOf,
  lastIndexOf,
  includes,
};

export const arrayFoldMethods = {
  reduce,
  reduceRight,
};

export const arrayMeasureMethods = {
  length,
  arrayJoin,
};

export const arrayFallthroughMethods = {
  ...arrayTransformMethods,
  ...arrayLookupMethods,
  ...arrayTestMethods,
  ...arrayFoldMethods,
  ...arrayMeasureMethods,
};
