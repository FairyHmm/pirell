import { describe, expect, it } from "vitest";
import { pipe } from "@pirell/core";
import { entries } from "./object.js";
import { filter, length, map, reduce, sort } from "./array.js";
import { pirell } from "../index.js";

// Domain data, bare — same fixtures as group.test.ts. Fluent callbacks
// are on `any` rows (fallthrough contract), so they need no annotations.

const orders = [
  { status: "paid", amount: 5 },
  { status: "paid", amount: 7 },
  { status: "unpaid", amount: 2 },
];

describe("array methods: rewrap", () => {
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
});

describe("array methods: terminal", () => {
  it("find returns the first match", () => {
    expect(pirell(orders).find((o) => o.amount > 3).value).toEqual({
      status: "paid",
      amount: 5,
    });
  });

  it("find yields undefined when nothing matches", () => {
    expect(pirell([1, 2]).find((n) => n > 9).value).toBeUndefined();
  });

  it("findIndex returns the position or -1", () => {
    expect(pirell([1, 2, 3]).findIndex((n) => n === 2).value).toBe(1);
    expect(pirell([1, 2, 3]).findIndex((n) => n === 9).value).toBe(-1);
  });

  it("some and every answer with booleans", () => {
    expect(pirell([1, 2, 3]).some((n) => n > 2).value).toBe(true);
    expect(pirell([1, 2, 3]).every((n) => n > 2).value).toBe(false);
  });

  it("indexOf and includes probe membership", () => {
    expect(pirell([1, 2, 3]).indexOf(2).value).toBe(1);
    expect(pirell([1, 2, 3]).includes(4).value).toBe(false);
    expect(pirell([1, 2, 3]).includes(2, 1).value).toBe(true);
  });

  it("reduce folds with and without an initializer", () => {
    expect(pirell([1, 2, 3]).reduce((a, b) => a + b, 0).value).toBe(6);
    expect(pirell([1, 2, 3]).reduce((a, b) => a + b).value).toBe(6);
  });

  it("length is a terminal method call", () => {
    expect(pirell([1, 2, 3]).length().value).toBe(3);
    expect(length([])).toBe(0);
  });
});

describe("object methods", () => {
  it("keys and values unwrap a record", () => {
    expect(pirell({ a: 1, b: 2 }).keys().value).toEqual(["a", "b"]);
    expect(pirell({ a: 1, b: 2 }).values().value).toEqual([1, 2]);
  });

  it("entries returns key/value pairs as rows", () => {
    expect(pirell({ a: 1, b: 2 }).entries().value).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
  });

  it("fromEntries rebuilds a record from pair rows", () => {
    const result = pirell([
      ["a", 1],
      ["b", 2],
    ]).fromEntries();
    expect(result.value).toEqual({ a: 1, b: 2 });
  });
});

describe("grouping + native methods compose", () => {
  it("groupBy then values keeps native fallthrough available", () => {
    const result = pirell(orders)
      .groupBy("status")
      .values()
      .flatMap((rows) => rows);
    expect(result.value).toHaveLength(3);
  });

  it("chained native methods stay fluent", () => {
    const result = pirell(orders)
      .filter((o) => o.amount > 3)
      .sort((a, b) => a.amount - b.amount)
      .map((o) => o.amount);
    expect(result.value).toEqual([5, 7]);
  });

  it("a terminal method ends the chain as a Scalar", () => {
    const result = pirell([1, 2, 3])
      .map((n) => n * 2)
      .reduce((a, b) => a + b, 0);
    expect(result.value).toBe(12);
  });
});

describe("native methods compose in pipe", () => {
  it("map -> filter -> reduce", () => {
    const total = pipe(
      [1, 2, 3, 4],
      map((n: number) => n * 2),
      filter((n: number) => n > 4),
      reduce((a, b) => a + b, 0),
    );
    expect(total).toBe(14);
  });

  it("object unpack -> array pipeline", () => {
    const pairs = pipe(
      { a: 1, b: 2 },
      entries,
      filter((p) => p[1] > 1),
    );
    expect(pairs).toEqual([["b", 2]]);
  });
});

describe("native shape rejection", () => {
  it("rejects keyed data for array methods and vice versa", () => {
    // Type check only — never runs
    if (false) {
      // @ts-expect-error -- map expects indexed, not ["k", ...]
      pirell({ a: 1 }).map((n) => n);
      // @ts-expect-error -- keys expects keyed, not ["i", ...]
      pirell([1, 2]).keys();
      // @ts-expect-error -- find expects indexed, not ["k", ...]
      pirell({ a: 1 }).find((n) => n);
    }
  });
});
