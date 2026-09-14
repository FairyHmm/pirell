import { describe, expect, it } from "vitest";
import { pirell } from "../index.js";
import { sort } from "./array.js";

// Domain data, bare — same fixtures as group.test.ts. Fluent callbacks
// are on `any` rows (fallthrough contract), so they need no annotations.

const orders = [
  { status: "paid", amount: 5 },
  { status: "paid", amount: 7 },
  { status: "unpaid", amount: 2 },
];

describe("array methods: transform", () => {
  it("map transforms values and rewraps as an open column", () => {
    const result = pirell([1, 2, 3]).map((n) => n * 2);
    expect(result.value).toEqual([2, 4, 6]);
  });

  it("map over table rows keeps the rows indexed", () => {
    const result = pirell(orders).map((o) => ({ ...o, amount: o.amount * 2 }));
    expect(result.value).toEqual([
      { status: "paid", amount: 10 },
      { status: "paid", amount: 14 },
      { status: "unpaid", amount: 4 },
    ]);
  });

  it("filter keeps matching rows", () => {
    const result = pirell(orders).filter((o) => o.amount > 3);
    expect(result.value).toEqual([
      { status: "paid", amount: 5 },
      { status: "paid", amount: 7 },
    ]);
  });

  it("sort sorts a copy, leaving the input untouched", () => {
    const input = [3, 1, 2];
    const sorted = sort()(input);
    expect(sorted).toEqual([1, 2, 3]);
    expect(input).toEqual([3, 1, 2]);
  });

  it("sort accepts a comparator", () => {
    const result = pirell(orders).sort((a, b) => b.amount - a.amount);
    expect(result.value).toEqual([
      { status: "paid", amount: 7 },
      { status: "paid", amount: 5 },
      { status: "unpaid", amount: 2 },
    ]);
  });

  it("slice returns a subrange without mutating", () => {
    const result = pirell([1, 2, 3, 4]).slice(1, 3);
    expect(result.value).toEqual([2, 3]);
  });

  it("flat flattens one level by default", () => {
    const result = pirell([[1, 2], [3]]).flat();
    expect(result.value).toEqual([1, 2, 3]);
  });

  it("flat respects an explicit depth", () => {
    const result = pirell([[[1]], [[2]]]).flat(2);
    expect(result.value).toEqual([1, 2]);
  });

  it("flatMap maps then flattens one level", () => {
    const result = pirell([1, 2, 3]).flatMap((n) => [n, n]);
    expect(result.value).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it("concat appends values and arrays", () => {
    const result = pirell([1, 2]).concat(3, [4, 5]);
    expect(result.value).toEqual([1, 2, 3, 4, 5]);
  });

  it("reverse rewraps with a copy, leaving the input untouched", () => {
    const input = [1, 2, 3];
    const result = pirell(input).reverse();
    expect(result.value).toEqual([3, 2, 1]);
    expect(input).toEqual([1, 2, 3]);
  });

  it("toSpliced removes a range in a copy", () => {
    const input = [1, 2, 3, 4];
    const result = pirell(input).toSpliced(1, 2);
    expect(result.value).toEqual([1, 4]);
    expect(input).toEqual([1, 2, 3, 4]);
  });

  it("with replaces one element without mutating", () => {
    const result = pirell([1, 2, 3]).with(1, 9);
    expect(result.value).toEqual([1, 9, 3]);
  });

  it("with accepts a negative index", () => {
    const result = pirell([1, 2, 3]).with(-1, 9);
    expect(result.value).toEqual([1, 2, 9]);
  });
});
