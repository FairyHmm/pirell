import { describe, expect, it } from "vitest";
import { pirell } from "../index.js";

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

  it("assign merges sources, right side winning", () => {
    const result = pirell({ a: 1, b: 2 }).assign({ b: 3, c: 4 });
    expect(result.value).toEqual({ a: 1, b: 3, c: 4 });
  });

  it("hasOwn answers key presence", () => {
    expect(pirell({ a: 1 }).hasOwn("a").value).toBe(true);
    expect(pirell({ a: 1 }).hasOwn("b").value).toBe(false);
  });
});
