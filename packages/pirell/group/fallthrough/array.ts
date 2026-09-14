/**
 * Native `Array` passthroughs. Any indexed (`["i", "..."]`) input is
 * accepted; array-returning methods rewrap as an open column, terminals
 * collapse to `Scalar` (read via `.value`). Each op forwards data
 * straight to a native method.
 *
 * ```ts
 * import { pirell } from "@pirell/group";
 *
 * pirell([3, 1, 2]).sort().value; // [1, 2, 3]
 * ```
 *
 * @module
 */
import type { Op } from "@pirell/core";

/** Shape claim for indexed (array) data. */
export type Indexed = ["i", "..."];
/** An op returning an open column — chainable. */
export type Rewrap = Op<Indexed, Indexed>;
/** An op collapsing to a scalar — ends the chain, read via `.value`. */
export type Terminal = Op<Indexed, []>;
/**
 * Walker over `(row, index)`. Caller types values; shapes stay the
 * library's business.
 */
export type ArrayCallback = (row: any, index: number) => any;

/**
 * Transforms each element, staying an open column.
 *
 * @param fn Produces each output element from `(row, index)`.
 */
export const map =
  (fn: ArrayCallback): Rewrap =>
  (data) =>
    data.map(fn);

/**
 * Keeps matching elements, staying an open column.
 *
 * @param pred Tests each element; truthy keeps it.
 */
export const filter =
  (pred: ArrayCallback): Rewrap =>
  (data) =>
    data.filter(pred);

/**
 * Sorts a copy — never mutates the input.
 *
 * @param compare Ordering function; without one, elements sort by
 * string conversion (native).
 */
export const sort =
  (compare?: (a: any, b: any) => number): Rewrap =>
  (data) =>
    data.toSorted(compare);

/**
 * Takes a subrange.
 *
 * @param start Where to start.
 * @param end Where to stop (exclusive).
 */
export const slice =
  (start?: number, end?: number): Rewrap =>
  (data) =>
    data.slice(start, end);

/**
 * Flattens nested arrays.
 *
 * @param depth How deep to flatten; default `1`.
 */
export const flat =
  (depth?: number): Rewrap =>
  (data) =>
    data.flat(depth);

/**
 * Maps each element, then flattens one level.
 *
 * @param fn Maps each element to zero or more outputs.
 */
export const flatMap =
  (fn: ArrayCallback): Rewrap =>
  (data) =>
    data.flatMap(fn);

/**
 * Appends values and arrays.
 *
 * @param items Values and arrays to append.
 */
export const concat =
  (...items: any[]): Rewrap =>
  (data) =>
    data.concat(...items);

/**
 * Reverses a copy — never mutates the input. Named for the operation,
 * as {@linkcode sort} calls `toSorted()`.
 */
export const reverse = (): Rewrap => (data) => data.toReversed();

/**
 * Replaces one element in a copy. Exported as `with_` (`with` is a
 * reserved word); the fluent method is `with`.
 *
 * @param index Position to replace, negatives from the end.
 * @param value Replacement value.
 */
export const with_ =
  (index: number, value: any): Rewrap =>
  (data) =>
    data.with(index, value);

/**
 * Splices a copy. The mutating `splice` is deliberately excluded.
 *
 * @param start Where to start changing the copy.
 * @param deleteCount How many to remove.
 * @param items Elements to insert in their place.
 */
export const toSpliced =
  (start: number, deleteCount?: number, ...items: any[]): Rewrap =>
  (data) =>
    data.toSpliced(start, deleteCount as number, ...items);

/**
 * Returns the first match, or `undefined`.
 *
 * @param pred Tests each element.
 */
export const find =
  (pred: ArrayCallback): Terminal =>
  (data) =>
    data.find(pred);

/**
 * Returns the first matching position, or `-1`.
 *
 * @param pred Tests each element.
 */
export const findIndex =
  (pred: ArrayCallback): Terminal =>
  (data) =>
    data.findIndex(pred);

/**
 * Returns the last match, or `undefined`.
 *
 * @param pred Tests each element.
 */
export const findLast =
  (pred: ArrayCallback): Terminal =>
  (data) =>
    data.findLast(pred);

/**
 * Returns the last matching position, or `-1`.
 *
 * @param pred Tests each element.
 */
export const findLastIndex =
  (pred: ArrayCallback): Terminal =>
  (data) =>
    data.findLastIndex(pred);

/**
 * Reads the element at an index, negatives from the end.
 *
 * @param index Position to read.
 */
export const at =
  (index: number): Terminal =>
  (data) =>
    data.at(index);

/**
 * Renders elements as a string. Renamed from native `join` —
 * `@pirell/relational` owns `join` for table joins.
 *
 * @param separator Placed between elements; default `","`.
 */
export const arrayJoin =
  (separator?: string): Terminal =>
  (data) =>
    data.join(separator);

/**
 * Answers whether any element matches.
 *
 * @param pred Tests each element.
 */
export const some =
  (pred: ArrayCallback): Terminal =>
  (data) =>
    data.some(pred);

/**
 * Answers whether every element matches.
 *
 * @param pred Tests each element.
 */
export const every =
  (pred: ArrayCallback): Terminal =>
  (data) =>
    data.every(pred);

/**
 * Returns the first occurrence position, or `-1`.
 *
 * @param value Value to search for.
 * @param fromIndex Where to start searching.
 */
export const indexOf =
  (value: any, fromIndex?: number): Terminal =>
  (data) =>
    data.indexOf(value, fromIndex);

/**
 * Returns the last occurrence position, or `-1`. An omitted
 * `fromIndex` scans back from the end; an explicit one scans back
 * from there.
 *
 * @param value Value to search for.
 */
export const lastIndexOf =
  (value: any, ...rest: [fromIndex?: number]): Terminal =>
  (data) => {
    // Explicit-undefined fromIndex coerces to 0 in native lastIndexOf —
    // keep the omitted form forwarding no second argument (as reduce).
    return rest.length === 0
      ? data.lastIndexOf(value)
      : data.lastIndexOf(value, rest[0]);
  };

/**
 * Answers membership, optionally searching from an index.
 *
 * @param value Value to test.
 * @param fromIndex Where to start searching.
 */
export const includes =
  (value: any, fromIndex?: number): Terminal =>
  (data) =>
    data.includes(value, fromIndex);

/** Counts elements. Also works standalone: `pipe(rows, length)`. */
export const length: Terminal = (data) => data.length;

/**
 * Folds left to a single value.
 *
 * ```ts
 * import { pirell } from "@pirell/group";
 *
 * pirell([1, 2, 3]).reduce((a, b) => a + b, 0).value; // 6
 * ```
 *
 * @param reducer Combines the accumulator with each element.
 * @param initial Seed; when omitted, no second argument is forwarded
 * at all (native `reduce` treats explicit-`undefined` differently).
 */
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

/**
 * Folds right to a single value. Same omitted-seed rule as
 * {@linkcode reduce}.
 *
 * @param reducer Combines the accumulator with each element.
 * @param initial Seed; when omitted, no second argument is forwarded.
 */
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

/** Column-returning array ops, as data for `extend`. */
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

/** Element-finding array ops, as data for `extend`. */
export const arrayLookupMethods = {
  find,
  findIndex,
  findLast,
  findLastIndex,
  at,
};

/** Boolean/index-probing array ops, as data for `extend`. */
export const arrayTestMethods = {
  some,
  every,
  indexOf,
  lastIndexOf,
  includes,
};

/** Folding array ops, as data for `extend`. */
export const arrayFoldMethods = {
  reduce,
  reduceRight,
};

/** Scalar-measure array ops, as data for `extend`. */
export const arrayMeasureMethods = {
  length,
  arrayJoin,
};

/**
 * All array fallthroughs, grouped by intent. Export order is the
 * public-surface order.
 */
export const arrayFallthroughMethods = {
  ...arrayTransformMethods,
  ...arrayLookupMethods,
  ...arrayTestMethods,
  ...arrayFoldMethods,
  ...arrayMeasureMethods,
};
