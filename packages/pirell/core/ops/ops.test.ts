import { describe, expect, it } from "vitest";
import { makeFlat, makeCurry } from "./ops.js";
import { compose } from "../entry/compose.js";
import { double, sumAll, nth } from "./fixture-ops.js";

// makeFlat/makeCurry flip calling convention with no shape knowledge —
// tested with plain fns to pin that contract.

describe("makeCurry: flat (data, ...args) => result → curried", () => {
  it("curries a plain function, threading args then data", () => {
    const add = (data: number, n: number, m: number) => data + n + m;
    const curried = makeCurry(add);
    expect(curried(1, 2)(10)).toBe(13); // (10 + 1) + 2
  });

  it("preserves argument and data types", () => {
    const join = (data: string[], sep: string) => data.join(sep);
    const curried = makeCurry(join);
    const result = curried("-")(["a", "b"]);
    const check: string = result;
    expect(check).toBe("a-b");
  });

  it("works with a zero-arg-data-only fn", () => {
    const len = (data: number[]) => data.length;
    const curried = makeCurry(len);
    expect(curried()([1, 2, 3])).toBe(3);
  });

  it("curries a normal flat function with payload args", () => {
    // makeCurry is shape-agnostic — pipe is gated, so makeCurry(pipe) is NOT
    // a gated compose (the generic path erases the chain constraint). The
    // gate round-trip is makeFlat's overload's job, not makeCurry's. Here we
    // only pin makeCurry on an ordinary (data, ...args) fn.
    const scale = (data: number[], factor: number) =>
      data.map((n) => n * factor);
    const curried = makeCurry(scale);
    expect(curried(3)([1, 2])).toEqual([3, 6]);
  });

  it("curries a flat fn that consumes a native op's output", () => {
    // A plain flat fn whose data is the result of a native op still curries
    // cleanly — makeCurry has no op/chain awareness. sumAll's Out is [] (no
    // shape claim), so its produced value types as unknown; Number() recovers
    // the numeric scalar without an assertion, which is the op seam's edge.
    const afterSum = (data: number, label: string) => `${label}:${data}`;
    const curried = makeCurry(afterSum);
    const total = Number(sumAll([1, 2, 3]));
    expect(curried("total")(total)).toBe("total:6");
  });
});

describe("makeFlat: curried (...args) => (data) => result → flat", () => {
  it("flattens a plain curried function", () => {
    const inc = (n: number) => (data: number) => data + n;
    const flat = makeFlat(inc);
    expect(flat(10, 2)).toBe(12); // data first, then args
  });

  it("flat form receives data first", () => {
    const pick = (key: string) => (data: Record<string, number>) => data[key];
    const flat = makeFlat(pick);
    expect(flat({ a: 5 }, "a")).toBe(5);
  });

  it("flattens a zero-arg curried fn", () => {
    const getLen = () => (data: number[]) => data.length;
    const flat = makeFlat(getLen);
    expect(flat([1, 2, 3])).toBe(3);
  });

  it("is the data-first view of compose (gated)", () => {
    // pipe itself is literally makeFlat(compose); re-derive to show the
    // converter produces the gated data-first form.
    const flat = makeFlat(compose);
    const result = flat([1, 2, 3], double, sumAll);
    expect(result).toBe(12);
  });
});

describe("makeFlat on native pirell ops (factories → flat)", () => {
  it("flattens a factory op into a data-first call", () => {
    const flat = makeFlat(nth);
    expect(flat([10, 20, 30], 1)).toBe(20);
  });
});
