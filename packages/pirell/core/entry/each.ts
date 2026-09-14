import { isSurface, valueOf } from "./surface.js";
import type { Op, Shape } from "../types/base.js";

/**
 * Shape claim for keyed (record) data: any `["k", ...]` node
 */
export type Keyed = ["k", "..."];

/**
 * Broadcasts an op across every value of a keyed record, rebuilding
 * the record from the results. Keyed in, keyed out.
 *
 * ```ts
 * import { pirell, sort } from "@pirell/group";
 * import { each, pipe } from "@pirell/core";
 *
 * // fluent: wired at every surface
 * pirell({ a: [3, 1], b: [2] }).each(sort()).value; // { a: [1, 3], b: [2] }
 *
 * // functional: any bare stage
 * pipe({ a: [3, 1], b: [2] }, each(sort()));
 *
 * // standalone: the returned op itself
 * const sortEach = each(sort());
 * sortEach({ a: [3, 1], b: [2] });
 * ```
 *
 * @param op The per-value operation. A `pirell()`-built surface is
 * invoked with each value and unwrapped via `valueOf`; a plain
 * function's return is used as-is.
 */
export const each =
  (op: (data: any) => any): Op<Keyed, Keyed> =>
  (data) =>
    Object.fromEntries(
      Object.entries(data as Record<string, unknown>).map(([key, value]) => [
        key,
        isSurface(op)
          ? valueOf((op as (d: unknown) => unknown)(value))
          : (op as (d: unknown) => unknown)(value),
      ]),
    ) as any;
