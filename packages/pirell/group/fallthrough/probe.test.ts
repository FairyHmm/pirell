import { describe, expect, it } from "vitest";
import { pirell } from "../index.js";

describe("array methods: test", () => {
  it("some and every answer with booleans", () => {
    expect(pirell([1, 2, 3]).some((n) => n > 2).value).toBe(true);
    expect(pirell([1, 2, 3]).every((n) => n > 2).value).toBe(false);
  });

  it("indexOf and includes probe membership", () => {
    expect(pirell([1, 2, 3]).indexOf(2).value).toBe(1);
    expect(pirell([1, 2, 3]).includes(4).value).toBe(false);
    expect(pirell([1, 2, 3]).includes(2, 1).value).toBe(true);
  });

  it("lastIndexOf finds the last occurrence or -1", () => {
    expect(pirell([1, 2, 3, 2]).lastIndexOf(2).value).toBe(3);
    expect(pirell([1, 2]).lastIndexOf(9).value).toBe(-1);
  });
});
