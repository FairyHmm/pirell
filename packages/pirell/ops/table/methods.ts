import { distinct } from "./distinct.js";
import { take, pluck, sort } from "./rows.js";
import { every, filter, find, findLast, some } from "./predicates.js";

/**
 * Shared field reader for row-oriented ops. Rows are shape-described;
 * field reads are the caller's promise, as in grouping's project.
 */
export const read = (row: unknown, key: string): unknown =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- caller-owned row contract (see doc comment above)
  (row as Record<string, unknown>)?.[key];

/** Row-oriented conveniences, as data for `extend`. */
export const tableMethods = {
  sort,
  distinct,
  take,
  pluck,
  filter,
  find,
  findLast,
  some,
  every,
};
