import { pirell as pirellRaw } from "@pirell/core";
import { groupBy, indexBy } from "./groups.js";

export { groupBy, indexBy, type GroupKey } from "./groups.js";

export const groupMethods = { groupBy, indexBy };
export const pirell = pirellRaw().extend(groupMethods);
