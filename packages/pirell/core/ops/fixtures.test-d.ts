// Compile-time-only type rejections through chains (see fixtures.test.ts) —
// statically checked, never runs.
import { double, toEntries, nth } from "./fixture-ops.js";

// nth rejects wrong-shape data.
{
  const obj = { a: 1 };
  // @ts-expect-error -- nth(0) expects ["i"], not ["k"]
  nth(0)(obj);
}

// toEntries rejects indexed data.
{
  const nums = [1, 2, 3];
  // @ts-expect-error -- toEntries expects ["k", "..."], not ["i"]
  toEntries(nums);
}

// double rejects keyed data.
{
  const obj = { a: 1 };
  // @ts-expect-error -- double expects [["i", number]], not ["k"]
  double(obj);
}

// double rejects an open tail ("i","i...") when expecting exactly "i".
{
  const pairs = [
    ["a", 1],
    ["b", 2],
  ];
  // @ts-expect-error -- double expects exactly [["i", number]], not ["i","i..."]
  double(pairs);
}
