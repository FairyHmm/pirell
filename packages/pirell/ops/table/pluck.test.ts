import { describe, expect, it } from "vitest";
import { pirell } from "../index.js";
import { pluck, rename } from "./rows.js";

// Domain data, bare — same fixtures as group.test.ts. Projection
// callbacks are caller-typed (rows contract), so they need annotations;
// string keys don't.

const orders = [
  { status: "paid", amount: 5 },
  { status: "paid", amount: 7 },
  { status: "unpaid", amount: 2 },
];

type Order = (typeof orders)[number];

describe("table rows: pluck", () => {
  it("projects a field to a column", () => {
    const result = pirell(orders).pluck("amount");
    expect(result.value).toEqual([5, 7, 2]);
  });

  it("projects by function", () => {
    const result = pirell(orders).pluck((o: Order) => o.amount * 2);
    expect(result.value).toEqual([10, 14, 4]);
  });

  it("missing fields project to undefined", () => {
    expect(pluck("nope")([{ a: 1 }])).toEqual([undefined]);
  });
});

describe("table rows: rename", () => {
  it("renames fields, carrying the rest", () => {
    const result = pirell(orders).rename({ amount: "total" });
    expect(result.value).toEqual([
      { status: "paid", total: 5 },
      { status: "paid", total: 7 },
      { status: "unpaid", total: 2 },
    ]);
  });

  it("renames simultaneously, so swaps work", () => {
    expect(rename({ a: "b", b: "a" })([{ a: 1, b: 2 }])).toEqual([
      { b: 1, a: 2 },
    ]);
  });

  it("ignores missing old names and passes scalars through", () => {
    expect(rename({ nope: "x" })([{ a: 1 }])).toEqual([{ a: 1 }]);
    expect(rename({ a: "b" })([1, 2])).toEqual([1, 2]);
  });

  it("feeds join-collision renames before joining", () => {
    const result = pirell(orders)
      .rename({ status: "order_status" })
      .pluck("order_status");
    expect(result.value).toEqual(["paid", "paid", "unpaid"]);
  });
});

describe("table rows: chaining", () => {
  it("sort, take, and pluck compose on the fluent surface", () => {
    const result = pirell(orders).sort("amount").take(2).pluck("status");
    expect(result.value).toEqual(["unpaid", "paid"]);
  });

  it("distinct feeds downstream ops", () => {
    const result = pirell(orders).distinct("status").pluck("amount");
    expect(result.value).toEqual([5, 2]);
  });
});
