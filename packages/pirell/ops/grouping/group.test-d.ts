// Compile-time-only pin for grouping shape rejection (see group.test.ts) —
// statically checked, never runs.
import { groupBy, indexBy } from "./groups.js";

{
  const nums = [1, 2, 3];
  // @ts-expect-error -- groupBy expects Table, not ["i"]
  groupBy("status")(nums);
  // @ts-expect-error -- indexBy expects Table, not ["i"]
  indexBy("id")(nums);
}
