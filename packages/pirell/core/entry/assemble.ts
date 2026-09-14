// pirell() runtime entry + re-exports (surface types live in types/;
// re-exported here as the backward-compatible import path).

import { buildDeferred, buildBound } from "./builders.js";
import type { Bound, Deferred } from "../types/base.js";
import type { ShapeOf } from "../types/codec.js";
import type { Assembled, OpMap } from "../types/assembled.js";
import type { OpMethods } from "../types/fluent.js";

export type { Assembled, OpMap };

/**
 * Binds data to a fluent surface. The shape is proven from the data;
 * each chained op is checked against it, and `.value` unwraps the
 * result.
 *
 * ```ts
 * import { pirell } from "@pirell/core";
 *
 * pirell([1, 2]).value; // [1, 2]
 * ```
 */
export function pirell<T>(
  data: T,
): Assembled<Bound<ShapeOf<T>>> & OpMethods<{}, Bound<ShapeOf<T>>>;
/**
 * Builds a deferred surface: no data yet, ops register for later.
 * Calling it with data binds and runs everything registered.
 */
export function pirell(): Assembled<Deferred<[]>> & OpMethods<{}, Deferred<[]>>;
export function pirell(...args: [unknown] | []): unknown {
  if (args.length === 0) {
    return buildDeferred([], {});
  }
  return buildBound(args[0], {});
}
