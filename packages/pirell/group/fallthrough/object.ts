// Native Object passthroughs. Fallthrough contract: any keyed (["k",
// "..."]) input is accepted; results rewrap as an open column
// (keys/values) or pair rows (entries). fromEntries takes pair rows
// and rebuilds a record.

import type { Op } from "@pirell/core";
import type { Indexed } from "./array.js";

// The four ops are native Object.* — assignment replaces the
// `(data) => ...` wrapper — with shared claim aliases below.
export type Keyed = ["k", "..."];
export type Pairs = ["i", "i..."];

export const keys: Op<Keyed, Indexed> = Object.keys;
export const values: Op<Keyed, Indexed> = Object.values;
export const entries: Op<Keyed, Pairs> = Object.entries;
export const fromEntries: Op<Pairs, ["k"]> = Object.fromEntries;

export const objectFallthroughMethods = {
  keys,
  values,
  entries,
  fromEntries,
};
