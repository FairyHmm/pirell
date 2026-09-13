import { pirell as pirellRaw } from "@pirell/core";
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
export const pirell = pirellRaw().extend(groupMethods);
