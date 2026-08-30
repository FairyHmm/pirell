import { describe, expect, it } from "vitest";
import {
  double,
  flattenEntries,
  sumValues,
  toEntries,
  entriesToObject,
} from "./test-utils.js";
import type { Raw } from "./types.js";

describe("type inference through chains", () => {
  it("i -> i: numbers stay numbered", () => {
    const nums = [1, 2, 3] as Raw<["i"]>;
    const result = double(nums);
    // If inference works, result is Raw<["i"]> and can feed back to double
    const doubled = double(result);
    expect(doubled).toEqual([4, 8, 12]);
  });

  it("k -> i...: object to entries preserves type through chain", () => {
    const obj = { a: 1, b: 2 } as Raw<["k"]>;
    const pairs = toEntries(obj);
    // Result is Raw<["i..."]> — can feed to flattenEntries
    const values = flattenEntries(pairs);
    expect(values).toEqual([1, 2]);
  });

  it("i... -> k -> i...: round-trip through keyed", () => {
    const pairs = [
      ["a", 1],
      ["b", 2],
    ] as Raw<["i..."]>;
    const obj = entriesToObject(pairs);
    // obj is Raw<["k"]> — can feed back to toEntries
    const roundtrip = toEntries(obj);
    // roundtrip is Raw<["i..."]> again — can chain further
    const values = flattenEntries(roundtrip);
    expect(values).toEqual([1, 2]);
  });

  it("k,i -> k: nested structure reduces cleanly", () => {
    const data = {
      team_a: [10, 20, 30],
      team_b: [5, 15],
    } as Raw<["k", "i", "..."]>;
    const sums = sumValues(data);
    // Result is Raw<["k"]> — object can feed back to toEntries
    const pairs = toEntries(sums);
    expect(pairs).toEqual([
      ["team_a", 60],
      ["team_b", 20],
    ]);
  });

  it("k,i,... -> k: open tail doesn't break the chain", () => {
    // ["k", "i", "..."] means object > array > unknown depth
    const data = {
      scores: [1, 2, 3],
      other: [10, 20],
    } as Raw<["k", "i", "..."]>;
    const sums = sumValues(data);
    // Result is Raw<["k"]> — clean, can continue
    const pairs = toEntries(sums);
    expect(pairs).toHaveLength(2);
  });

  it("open tail chains: entries -> values -> numbers", () => {
    const mixed = [
      ["x", 10],
      ["y", 20],
      ["z", 30],
    ] as Raw<["i..."]>;
    const values = flattenEntries(mixed);
    // values is Raw<["i"]> — can feed to double
    const doubled = double(values);
    expect(doubled).toEqual([20, 40, 60]);
  });

  it("complex chain: k -> i... -> i -> i", () => {
    const obj = { p: 5, q: 10 } as Raw<["k"]>;
    const pairs = toEntries(obj);
    const values = flattenEntries(pairs);
    const doubled = double(values);
    expect(doubled).toEqual([10, 20]);
  });
});

describe("type rejection through chains", () => {
  it("rejects passing i to an op expecting k", () => {
    // Type check only — never runs
    if (false) {
      const nums = [1, 2, 3] as Raw<["i"]>;
      // @ts-expect-error -- toEntries expects ["k", "..."], not ["i"]
      toEntries(nums);
    }
  });

  it("rejects passing k to an op expecting i", () => {
    // Type check only — never runs
    if (false) {
      const obj = { a: 1 } as Raw<["k"]>;
      // @ts-expect-error -- double expects ["i"], not ["k"]
      double(obj);
    }
  });

  it("rejects i... when expecting exactly i (open tail mismatch)", () => {
    // Type check only — never runs
    if (false) {
      const pairs = [
        ["a", 1],
        ["b", 2],
      ] as Raw<["i..."]>;
      // @ts-expect-error -- double expects exactly ["i"], not ["i..."]
      double(pairs);
    }
  });

  it("rejects k,i when expecting k (depth mismatch)", () => {
    // Type check only — never runs
    if (false) {
      const nested = { x: [1, 2] } as Raw<["k", "i"]>;
      // @ts-expect-error -- toEntries expects exactly ["k"], got ["k", "i"]
      toEntries(nested);
    }
  });
});
