// Compile-time-only pin for join shape rejection (see join.test.ts) —
// statically checked, never runs.
import { join } from "./join.js";

{
  const nums = [1, 2, 3];
  const rows = [{ id: 1 }];
  // @ts-expect-error -- join expects Table, not ["i"]
  join(rows)(nums);
  // @ts-expect-error -- cross joins take no `on`
  join(rows, { join: "cross", on: ["id", "id"] })(rows);
}
