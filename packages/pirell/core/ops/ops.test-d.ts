// Compile-time-only wrong-arg rejections for makeFlat (see ops.test.ts) —
// statically checked, never runs.
import { makeFlat } from "./ops.js";
import { nth } from "./fixture-ops.js";

{
  const inc = (n: number) => (data: number) => data + n;
  const flat = makeFlat(inc);
  // @ts-expect-error -- flat(data, arg) — string isn't a number arg
  flat(1, "x");
}

{
  const flat = makeFlat(nth);
  // @ts-expect-error -- flat(data, arg) — string isn't an index arg
  flat([1, 2, 3], "x");
}
