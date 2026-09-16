// Compile-time-only pin (see each.test.ts) — statically checked, never runs.
import { pirell } from "../index.js";
import type { Op } from "@pirell/core";

const double: Op<[["i", number]], [["i", number]]> = (data) =>
  data.map((n) => n * 2);

{
  const nums = [1, 2, 3];
  // @ts-expect-error -- each expects Keyed, not ["i"]
  pirell(nums).each(double);
}
