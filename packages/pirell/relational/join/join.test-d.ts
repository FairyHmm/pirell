// Compile-time-only pins for join shape rejection (see join.test.ts) —
// statically checked, never runs.
import { pirell } from "../index.js";
import { join } from "./join.js";

{
  const nums = [1, 2, 3];
  const rows = [{ id: 1 }];
  // @ts-expect-error -- join expects Table, not ["i"]
  join(rows)(nums);
  // @ts-expect-error -- cross joins take no `on`
  join(rows, { join: "cross", on: ["id", "id"] })(rows);
  // @ts-expect-error -- joinDb expects Db, not ["i"]
  pirell(nums).joinDb("a", "b");
  // Uniform dbs prove a uniform stack, not Db — join those tables
  // with standalone join instead.
  const homo = { a: [{ x: 1 }], b: [{ x: 2 }] };
  // @ts-expect-error -- homo db is ["k", ...], not ["k..."]
  pirell(homo).joinDb("a", "b");
}
