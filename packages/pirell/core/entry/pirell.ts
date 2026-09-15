// Surface machinery: builds a bare surface (`ops: {}`); coreOps lives
// in index.ts, which imports this and wires the ops in via `extend`.

import { buildDeferred, buildBound } from "./builders.js";
import type { ShapeOf } from "../types/codec.js";
import type { BoundWith } from "../types/assembled.js";
import type { Deferred } from "../types/base.js";

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
export function pirell(): Deferred<[]>;
export function pirell(...args: [unknown] | []): unknown {
  if (args.length === 0) {
    return buildDeferred([], {});
  }
  return buildBound(args[0], {});
}
