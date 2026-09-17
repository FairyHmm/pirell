import { describe, expect, it } from "vitest";
import { pirell } from "../index.js";
import { pluck } from "./rows.js";

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
