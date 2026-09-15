import { isSurface, valueOf } from "./surface.js";
import type { Op } from "../types/base.js";

/** Shape claim for keyed (record) data. */
export type Keyed = ["k", "..."];

/**
 * Broadcasts an op across every value of a keyed record, rebuilding
 * the record from the results. Keyed in, keyed out.
 *
 * ```ts
 * import type { Op } from "@pirell/core";
 *
 * const double: Op<[["i", number]], [["i", number]]> = (ns) =>
 *   ns.map((n) => n * 2);
 * const doubleEach = each(double);
 * doubleEach({ a: [1, 2], b: [3] }); // { a: [2, 4], b: [6] }
 * ```
 *
 * @param op Per-value operation. A `pirell()` surface is invoked with
 * each value and unwrapped via {@linkcode valueOf}; a plain function's
 * return is used as-is.
 */
export const each =
  (op: (data: any) => any): Op<Keyed, Keyed> =>
  (data) =>
    Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        isSurface(op)
          ? valueOf((op as (d: unknown) => unknown)(value))
          : (op as (d: unknown) => unknown)(value),
      ]),
    );
