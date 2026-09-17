import { describe, expect, it } from "vitest";
import { pipe } from "@pirell/core";
import { pirell } from "../index.js";
import { entries } from "./object.js";
import { filter } from "../table/predicates.js";
import { map, reduce } from "./array.js";

// Domain data, bare — same fixtures as group.test.ts. Fluent callbacks
// are typed here so the fallthrough goes any-≤ the assertions.

const orders = [
  { status: "paid", amount: 5 },
  { status: "paid", amount: 7 },
  { status: "unpaid", amount: 2 },
];

type Order = (typeof orders)[number];

describe("grouping + native methods compose", () => {
  it("groupBy then values keeps native fallthrough available", () => {
    const result = pirell(orders)
      .groupBy("status")
      .values()
      .flatMap((rows: Order[]) => rows);
    expect(result.value).toHaveLength(3);
  });

  it("chained native methods stay fluent", () => {
    const result = pirell(orders)
      .filter((o: Order) => o.amount > 3)
      .sort((a: Order, b: Order) => a.amount - b.amount)
      .map((o: Order) => o.amount);
    expect(result.value).toEqual([5, 7]);
  });

  it("a terminal method ends the chain as a Scalar", () => {
    const result = pirell([1, 2, 3])
      .map((n: number) => n * 2)
      .reduce((a: number, b: number) => a + b, 0);
    expect(result.value).toBe(12);
  });
});

describe("native methods compose in pipe", () => {
  it("map -> filter -> reduce", () => {
    const total = pipe(
      [1, 2, 3, 4],
      map((n: number) => n * 2),
      filter((n: number) => n > 4),
      reduce((a: number, b: number) => a + b, 0),
    );
    expect(total).toBe(14);
  });

  it("object unpack -> array pipeline", () => {
    const pairs = pipe(
      { a: 1, b: 2 },
      entries,
      filter((p: [string, number]) => p[1] > 1),
    );
    expect(pairs).toEqual([["b", 2]]);
  });
});
