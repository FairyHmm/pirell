// Bare surface (ops: {}); coreOps wiring lives in index.ts.

import { buildDeferred, buildBound } from "./builders.js";
import type { ShapeOf } from "../types/codec.js";
import type { BoundWith } from "../types/wrapper.js";
import type { Deferred } from "../types/base.js";

/** Binds data to a fluent surface: shape proven from data, ops checked per call, `.value` unwraps. */
export function pirell<T>(
  data: T,
): BoundWith<Record<never, never>, ShapeOf<T>, T>;
/** Builds a deferred surface: no data yet, ops register for later. Calling it with data binds and runs everything registered. */
export function pirell(): Deferred<[]>;
export function pirell(...args: [unknown] | []): unknown {
  if (args.length === 0) {
    return buildDeferred([], {});
  }
  return buildBound(args[0], {});
}
