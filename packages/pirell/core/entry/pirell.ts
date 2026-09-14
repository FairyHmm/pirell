// Surface machinery: builds a bare surface with whatever ops map it's
// given (callers pass `{}`); coreOps lives in index.ts, which imports
// this and wires them in.

import { buildDeferred, buildBound } from "./builders.js";
import type { ShapeOf } from "../types/codec.js";
import type { BoundWith, Extended, OpMap } from "../types/assembled.js";
import type { Dim } from "../types/base.js";

/**
 * Bare data-bound wrapper: value only, no ops, no shape inference.
 * Never holds `undefined`.
 */
export class Wrapper<S> {
  constructor(public readonly value: unknown) {
    // Mirror pirell(undefined): a Wrapper must never hold undefined.
    if (value === undefined) {
      throw new TypeError("Wrapper cannot hold undefined — pass a JSON value.");
    }
  }
}

/**
 * Binds data to a fluent surface. The shape is proven from the data;
 * each chained op is checked against it, and `.value` unwraps the
 * result.
 *
 * ```ts
 * pirell([1, 2]).value; // [1, 2]
 * ```
 */
export function pirell<T>(data: T): BoundWith<{}, ShapeOf<T>>;
/**
 * Builds a deferred surface: no data yet, ops register for later.
 * Calling it with data binds and runs everything registered.
 */
export function pirell(): Extended<{}>;
export function pirell(...args: [unknown] | []): unknown {
  if (args.length === 0) {
    return buildDeferred([], {});
  }
  return buildBound(args[0], {});
}

/**
 * The raw data-bound wrap, kept separate and pure so the wrap step
 * never needs to know what an "op" is (nor which ops are "core").
 */
export function bindValue<T>(data: T): Wrapper<Dim[]> {
  // pirell(undefined) is distinct from a missing argument — throw
  if (arguments.length === 0 || data === undefined) {
    throw new TypeError("pirell(undefined) is not valid — pass a JSON value.");
  }
  return new Wrapper(data);
}
