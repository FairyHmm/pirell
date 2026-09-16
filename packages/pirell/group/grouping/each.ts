import { isSurface, valueOf } from "@pirell/core";
import type { Op } from "@pirell/core";
import type { Keyed } from "../fallthrough/object.js";

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each value's type is caller-authored; unknown's param would reject typed ops by contravariance. The return is never narrowed — valueOf consumes it or it is returned as-is.
  (op: (data: any) => unknown): Op<Keyed, Keyed> =>
  (data) =>
    Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        isSurface(op) ? valueOf(op(value)) : op(value),
      ]),
    );
