import { describe, expect, it } from "vitest";
import { pirell } from "../index.js";

// Fluent callbacks are on `any` rows (fallthrough contract), so they
// need no annotations.

describe("array methods: lookup", () => {
  it("findIndex returns the position or -1", () => {
    expect(pirell([1, 2, 3]).findIndex((n) => n === 2).value).toBe(1);
    expect(pirell([1, 2, 3]).findIndex((n) => n === 9).value).toBe(-1);
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
