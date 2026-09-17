import { describe, expect, it } from "vitest";
import { take } from "./rows.js";

describe("table rows: take", () => {
  it("takes the first n elements as a copy", () => {
    const input = [1, 2, 3, 4];
    const result = take(2)(input);
    expect(result).toEqual([1, 2]);
    expect(result).not.toBe(input);
  });

  it("overshoot yields the whole input", () => {
    expect(take(10)([1, 2])).toEqual([1, 2]);
  });

  it("non-positive yields empty", () => {
    expect(take(0)([1, 2])).toEqual([]);
    expect(take(-3)([1, 2])).toEqual([]);
  });
});
