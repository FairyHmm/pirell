import { describe, it, expect } from "vitest";
import { pirell } from "./pirell.js";
import { extend } from "./extend.js";
import type { Pirell as PirellT } from "./types.js";

const double = (data: PirellT<any, number[]>) => ({
  shape: data.shape,
  value: data.value.map((n: number) => n * 2),
});

describe("standalone extend()", () => {
  it("applied directly, mirrors the .extend() method", () => {
    const chain = extend({ double })(pirell()).double();
    const result = chain({ shape: ["i"], value: [1, 2, 3] });
    expect(result.value).toEqual([2, 4, 6]);
  });

  it("works on a data-bound Wrapper too", () => {
    // extend(ops) accepts either Deferred or Wrapper — same wiring mechanism
    const result = extend({ double })(pirell([1, 2, 3])).double().value;
    expect(result).toEqual([2, 4, 6]);
  });
});
