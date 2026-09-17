import { describe, expect, it } from "vitest";
import { pirell } from "../index.js";
import { sort } from "./rows.js";

// Domain data, bare — same fixtures as group.test.ts. Fluent callbacks
// are on `any` rows (rows contract), so they need no annotations.

const orders = [
  { status: "paid", amount: 5 },
  { status: "paid", amount: 7 },
  { status: "unpaid", amount: 2 },
];

type Order = (typeof orders)[number];

describe("table rows: sort", () => {
  it("sorts a copy, leaving the input untouched", () => {
    const input = [3, 1, 2];
    const sorted = sort()(input);
    expect(sorted).toEqual([1, 2, 3]);
    expect(input).toEqual([3, 1, 2]);
  });

  it("accepts a comparator", () => {
    const result = pirell(orders).sort(
      (a: Order, b: Order) => b.amount - a.amount,
    );
    expect(result.value).toEqual([
      { status: "paid", amount: 7 },
      { status: "paid", amount: 5 },
      { status: "unpaid", amount: 2 },
    ]);
  });

  it("sorts rows by a key, numerically", () => {
    const result = pirell(orders).sort("amount");
    expect(result.value).toEqual([
      { status: "unpaid", amount: 2 },
      { status: "paid", amount: 5 },
      { status: "paid", amount: 7 },
    ]);
  });

  it("sorts rows by a string key", () => {
    const result = pirell(orders).sort("status");
    expect(result.value).toEqual([
      { status: "paid", amount: 5 },
      { status: "paid", amount: 7 },
      { status: "unpaid", amount: 2 },
    ]);
  });

  it("keeps input order for rows missing the key", () => {
    const rows = [{ a: 1 }, {}, { a: 0 }];
    expect(sort("a")(rows)).toEqual([{ a: 1 }, {}, { a: 0 }]);
  });
});
