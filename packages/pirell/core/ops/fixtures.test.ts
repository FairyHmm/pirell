import { describe, expect, it } from "vitest";
import {
  double,
  flattenEntries,
  sumValues,
  toEntries,
  entriesToObject,
  nth,
} from "./fixture-ops.js";

// Head-node literals go bare (no cast) — ShapeOf derives shape
// structurally, including mixed tails (see shape-inference.md).

describe("type inference through chains", () => {
  it("i -> i: numbers stay numbered", () => {
    const nums = [1, 2, 3];
    const result = double(nums);
    // If inference works, result is Raw<["i"]> and can feed back to double
    const doubled = double(result);
    expect(doubled).toEqual([4, 8, 12]);
  });

  it("k -> i...: object to entries preserves type through chain", () => {
    const obj = { a: 1, b: 2 };
    const pairs = toEntries(obj);
    // Result is Raw<["i","i..."]> — can feed to flattenEntries
    const values = flattenEntries(pairs);
    expect(values).toEqual([1, 2]);
  });

  it("i... -> k -> i...: round-trip through keyed", () => {
    const pairs = [
      ["a", 1],
      ["b", 2],
    ];
    const obj = entriesToObject(pairs);
    // obj is Raw<["k"]> — can feed back to toEntries
    const roundtrip = toEntries(obj);
    // roundtrip is Raw<["i","i..."]> again — can chain further
    const values = flattenEntries(roundtrip);
    expect(values).toEqual([1, 2]);
  });

  it("k,i -> k: nested structure reduces cleanly", () => {
    const data = {
      team_a: [10, 20, 30],
      team_b: [5, 15],
    };
    const sums = sumValues(data);
    // Result is Raw<["k"]> — object can feed back to toEntries
    const pairs = toEntries(sums);
    expect(pairs).toEqual([
      ["team_a", 60],
      ["team_b", 20],
    ]);
  });

  it("k,i,... -> k: open tail doesn't break the chain", () => {
    const data = {
      scores: [1, 2, 3],
      other: [10, 20],
    };
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
    ];
    const values = flattenEntries(mixed);
    // values is Raw<["i"]> — can feed to double
    const doubled = double(values);
    expect(doubled).toEqual([20, 40, 60]);
  });

  it("complex chain: k -> i... -> i -> i", () => {
    const obj = { p: 5, q: 10 };
    const pairs = toEntries(obj);
    const values = flattenEntries(pairs);
    const doubled = double(values);
    expect(doubled).toEqual([10, 20]);
  });
});

// op()'s dual-form dispatcher (non-empty Args), exercised via `nth`.
// See BUGS.md #8 / archive/BUGS-fixed.md for why this needed coverage.
describe("op() dual-form dispatch (non-empty Args)", () => {
  it("data-first: nth(data, i) applies immediately", () => {
    const result = nth([10, 20, 30], 1);
    expect(result).toBe(20);
  });

  it("curried: nth(i)(data) applies once data arrives", () => {
    const result = nth(1)([10, 20, 30]);
    expect(result).toBe(20);
  });

  it("curried form is reusable across different data", () => {
    const second = nth(2);
    expect(second([10, 20, 30])).toBe(30);
    expect(second(["a", "b", "c"])).toBe("c");
  });

  it("rejects wrong-shape data in data-first form", () => {
    // Type check only — never runs
    if (false) {
      const obj = { a: 1 };
      // @ts-expect-error -- nth expects ["i"], not ["k"]
      nth(obj, 0);
    }
  });

  it("rejects wrong-shape data in curried form", () => {
    // Type check only — never runs
    if (false) {
      const obj = { a: 1 };
      // @ts-expect-error -- nth expects ["i"], not ["k"]
      nth(0)(obj);
    }
  });
});

describe("type rejection through chains", () => {
  it("rejects passing i to an op expecting k", () => {
    // Type check only — never runs
    if (false) {
      const nums = [1, 2, 3];
      // @ts-expect-error -- toEntries expects ["k", "..."], not ["i"]
      toEntries(nums);
    }
  });

  it("rejects passing k to an op expecting i", () => {
    // Type check only — never runs
    if (false) {
      const obj = { a: 1 };
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
      ];
      // @ts-expect-error -- double expects exactly ["i"], not ["i","i..."]
      double(pairs);
    }
  });

  it("rejects k,i when expecting k (depth mismatch)", () => {
    // Type check only — never runs
    if (false) {
      const nested = { x: [1, 2] };
      // @ts-expect-error -- toEntries expects exactly ["k"], got ["k", "i"]
      toEntries(nested);
    }
  });
});
