import { describe, expect, it } from "vitest";
import { pirell } from "../index.js";
import { length } from "./array.js";

describe("array methods: fold", () => {
  it("reduce folds with and without an initializer", () => {
    expect(pirell([1, 2, 3]).reduce((a: number, b: number) => a + b, 0).value).toBe(6);
    expect(pirell([1, 2, 3]).reduce((a: number, b: number) => a + b).value).toBe(6);
  });

  it("reduceRight folds right-to-left", () => {
    expect(
      pirell(["a", "b", "c"]).reduceRight((acc: string, v: string) => acc + v)
        .value,
    ).toBe("cba");
  });
});

describe("array methods: measure", () => {
  it("length is a terminal method call", () => {
    expect(pirell([1, 2, 3]).length().value).toBe(3);
    expect(length([])).toBe(0);
  });

  it("arrayJoin renders a string with a separator or default", () => {
    expect(pirell([1, 2, 3]).arrayJoin("-").value).toBe("1-2-3");
    expect(pirell([1, 2, 3]).arrayJoin().value).toBe("1,2,3");
  });
});
