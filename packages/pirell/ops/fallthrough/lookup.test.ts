import { describe, expect, it } from "vitest";
import { pirell } from "../index.js";

// Domain data, bare — same fixtures as group.test.ts. Fluent callbacks
// are on `any` rows (fallthrough contract), so they need no annotations.

const orders = [
  { status: "paid", amount: 5 },
  { status: "paid", amount: 7 },
  { status: "unpaid", amount: 2 },
];

describe("array methods: lookup", () => {
  it("find returns the first match", () => {
    expect(pirell(orders).find((o: { amount: number }) => o.amount > 3).value).toEqual({
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

  it("findLast returns the last match", () => {
    expect(pirell([1, 2, 3, 2]).findLast((n) => n === 2).value).toBe(2);
  });

  it("findLastIndex returns the last position or -1", () => {
    expect(pirell([1, 2, 3, 2]).findLastIndex((n) => n === 2).value).toBe(3);
    expect(pirell([1, 2]).findLastIndex((n) => n === 9).value).toBe(-1);
  });

  it("at reads by index, including negatives", () => {
    expect(pirell([5, 6, 7]).at(1).value).toBe(6);
    expect(pirell([5, 6, 7]).at(-1).value).toBe(7);
  });
});
