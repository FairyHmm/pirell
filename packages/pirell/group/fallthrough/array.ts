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

// Each op just forwards data to a native method; the wrappers supply the
// Rewrap/Terminal conversion once.
const rewrap =
  (apply: (data: any[]) => any): Rewrap =>
  (data) =>
    apply(data);
const terminal =
  (apply: (data: any[]) => any): Terminal =>
  (data) =>
    apply(data);

export const map = (fn: ArrayCallback) => rewrap((data) => data.map(fn));

export const filter = (pred: ArrayCallback) =>
  rewrap((data) => data.filter(pred));

export const sort = (compare?: (a: any, b: any) => number) =>
  rewrap((data) => data.toSorted(compare));

export const slice = (start?: number, end?: number) =>
  rewrap((data) => data.slice(start, end));

export const flat = (depth?: number) => rewrap((data) => data.flat(depth));

export const flatMap = (fn: ArrayCallback) =>
  rewrap((data) => data.flatMap(fn));

export const find = (pred: ArrayCallback) =>
  terminal((data) => data.find(pred));

export const findIndex = (pred: ArrayCallback) =>
  terminal((data) => data.findIndex(pred));

export const some = (pred: ArrayCallback) =>
  terminal((data) => data.some(pred));

export const every = (pred: ArrayCallback) =>
  terminal((data) => data.every(pred));

export const indexOf = (value: any, fromIndex?: number) =>
  terminal((data) => data.indexOf(value, fromIndex));

export const includes = (value: any, fromIndex?: number) =>
  terminal((data) => data.includes(value, fromIndex));

export const length = terminal((data) => data.length);

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

export const arrayFallthroughMethods = {
  map,
  filter,
  sort,
  slice,
  flat,
  flatMap,

  find,
  findIndex,
  some,
  every,
  indexOf,
  includes,
  reduce,
  length,
};
