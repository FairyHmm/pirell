/** Key inference conveniences (spec producers); machinery lives in `keys.ts`. */
import { singularize } from "nano-string-utils";
import type { JoinKeys, KeyResolver, Row } from "./keys.js";

/**
 * Name-convention key inference for named tables. Tries, in order:
 *
 * - left-centric: `left.id` ↔ `right.<singular(left)>_id`
 * - right-centric: `right.id` ↔ `left.<singular(right)>_id`
 * - {@linkcode naturalKey }.
 *
 * First hit wins; if nothing matches, the natural error surfaces — pass
 * explicit `on` to skip the convention entirely.
 */
export const autoKey = (
  leftName: string,
  rightName: string,
  left: Row | undefined,
  right: Row | undefined,
): JoinKeys => {
  const leftFk = `${singularize(rightName)}_id`;
  const rightFk = `${singularize(leftName)}_id`;
  if (left?.["id"] !== undefined && right?.[rightFk] !== undefined)
    return ["id", rightFk];
  if (right?.["id"] !== undefined && left?.[leftFk] !== undefined)
    return [leftFk, "id"];
  return naturalKey(left, right);
};

/**
 * Shared field of both first rows, as a tuple; zero/multiple throws.
 * Branded: passing the function hashes like the tuple.
 */
export const naturalKey: KeyResolver = Object.assign(
  (left: Row | undefined, right: Row | undefined): JoinKeys => {
    const rightKeys = new Set(Object.keys(right ?? {}));
    const shared = Object.keys(left ?? {}).filter((k) => rightKeys.has(k));
    if (shared.length === 0)
      throw new Error(
        "join: no shared key between the tables — pass explicit `on`",
      );
    if (shared.length > 1)
      throw new Error(
        `join: ambiguous shared keys (${shared.join(", ")}) — pass explicit \`on\``,
      );
    const [key = ""] = shared;
    return [key, key];
  },
  { __keyResolver: true as const },
);
