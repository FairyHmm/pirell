import { describe, expect, it } from "vitest";
import { pirell } from "../index.js";
import { avg, max, min, sum } from "./aggregate.js";

// Domain data, bare — same fixtures as group.test.ts. Projection
// callbacks are caller-typed (rows contract), so they need annotations;
// string keys don't.

const orders = [
  { status: "paid", amount: 5 },
  { status: "paid", amount: 7 },
  { status: "unpaid", amount: 2 },
];

type Order = (typeof orders)[number];

describe("table rows: sum", () => {
  it("sums a column of numbers", () => {
    expect(pirell([1, 2, 3]).sum().value).toBe(6);
  });

  it("sums by field, fluent or standalone", () => {
    expect(pirell(orders).sum("amount").value).toBe(14);
    expect(sum("amount")(orders)).toBe(14);
  });

  it("sums by projection function", () => {
    expect(pirell(orders).sum((o: Order) => o.amount * 2).value).toBe(28);
  });

  it("skips non-numeric values; empty totals 0", () => {
    expect(sum()([1, null, 2, undefined, NaN, "x"])).toBe(3);
    expect(sum()([])).toBe(0);
    expect(pirell(orders).sum("status").value).toBe(0);
  });
});

describe("table rows: avg", () => {
  it("averages a column, by field, or by projection", () => {
    expect(pirell([1, 2, 3]).avg().value).toBe(2);
    expect(pirell(orders).avg("amount").value).toBeCloseTo(14 / 3);
    expect(avg((o: Order) => o.amount)(orders)).toBeCloseTo(14 / 3);
  });

  it("skips non-numeric values; empty averages NaN", () => {
    expect(avg()([1, null, 3])).toBe(2);
    expect(avg()([])).toBeNaN();
  });
});

describe("table rows: max and min", () => {
  it("finds extremes of a column", () => {
    expect(pirell([3, 1, 2]).max().value).toBe(3);
    expect(pirell([3, 1, 2]).min().value).toBe(1);
  });

  it("compares by field or projection", () => {
    expect(pirell(orders).max("amount").value).toBe(7);
    expect(pirell(orders).min((o: Order) => o.amount).value).toBe(2);
    expect(max("status")(orders)).toBe("unpaid");
    expect(min("status")(orders)).toBe("paid");
  });

  it("skips nullish values; empty yields undefined", () => {
    expect(max()([null, 2, undefined])).toBe(2);
    expect(min()([])).toBeUndefined();
    expect(max()([])).toBeUndefined();
  });
});

describe("table rows: aggregates chain", () => {
  it("filter then aggregate stays fluent", () => {
    expect(pirell(orders).filter("amount").sum("amount").value).toBe(14);
    expect(pirell(orders).distinct("status").pluck("amount").max().value).toBe(
      5,
    );
  });
});
