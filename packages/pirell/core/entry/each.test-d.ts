// Compile-time-only pin (see each.test.ts) — statically checked, never runs.
import { pirell } from "../index.js";
import { double } from "../ops/fixture-ops.js";

{
  const nums = [1, 2, 3];
  // @ts-expect-error -- each expects Keyed, not ["i"]
  pirell(nums).each(double);
}
