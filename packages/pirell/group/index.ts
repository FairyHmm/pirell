import { pirell as pirellRaw } from "@pirell/core";
import type { Extended } from "@pirell/core";
import { groupingMethods } from "./groups.js";
import { arrayFallthroughMethods } from "./fallthrough/array.js";
import { objectFallthroughMethods } from "./fallthrough/object.js";

export * from "./groups.js";
export * from "./fallthrough/array.js";
export * from "./fallthrough/object.js";

export const groupMethods = {
  ...groupingMethods,
  ...arrayFallthroughMethods,
  ...objectFallthroughMethods,
};
// The deferred surface with the group ops re-wired. tsc verifies the
// match against .extend() at each build.
export type GroupOps = typeof groupMethods;
export const pirell: Extended<GroupOps> = pirellRaw().extend(groupMethods);
