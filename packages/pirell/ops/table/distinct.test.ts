import { describe, expect, it } from "vitest";
import { pirell } from "../index.js";
import { distinct } from "./distinct.js";

// Domain data, bare — same fixtures as group.test.ts. Key-function
// callbacks are caller-typed (rows contract), so they need annotations;
// string keys don't.

const orders = [
  { status: "paid", amount: 5 },
  { status: "paid", amount: 7 },
  { status: "unpaid", amount: 2 },
];

type Order = (typeof orders)[number];

describe("table rows: distinct", () => {
  it("dedupes whole rows regardless of key insertion order", () => {
    const rows = [
      { a: 1, b: 2 },
      { b: 2, a: 1 },
      { a: 1, b: 3 },
    ];
    expect(distinct()(rows)).toEqual([
      { a: 1, b: 2 },
      { a: 1, b: 3 },
    ]);
  });

  it("dedupes scalars by value", () => {
    expect(distinct()([1, 2, 1, 3, 2])).toEqual([1, 2, 3]);
  });

  it("compares nested values by reference", () => {
    const shared = { x: 1 };
    const rows = [
      { id: 1, nest: shared },
      { id: 1, nest: shared },
      { id: 1, nest: { x: 1 } },
    ];
    expect(distinct()(rows)).toEqual([
      { id: 1, nest: shared },
      { id: 1, nest: { x: 1 } },
    ]);
  });

  it("dedupes by a single key", () => {
    const result = pirell(orders).distinct("status");
    expect(result.value).toEqual([
      { status: "paid", amount: 5 },
      { status: "unpaid", amount: 2 },
    ]);
  });

  it("dedupes by key tuples", () => {
    const rows = [
      { a: 1, b: 1 },
      { a: 1, b: 2 },
      { a: 1, b: 1 },
    ];
    expect(distinct(["a", "b"])(rows)).toEqual([
      { a: 1, b: 1 },
      { a: 1, b: 2 },
    ]);
  });

  it("dedupes by a projection function", () => {
    const result = pirell(orders).distinct((o: Order) => o.amount > 3);
    expect(result.value).toEqual([
      { status: "paid", amount: 5 },
      { status: "unpaid", amount: 2 },
    ]);
  });

  it("treats missing keys as one bucket", () => {
    const rows = [{ a: 1 }, {}, {}];
    expect(distinct("a")(rows)).toEqual([{ a: 1 }, {}]);
  });
});
