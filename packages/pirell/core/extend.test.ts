import { describe, it, expect } from "vitest";
import { pirell } from "./assemble.js";
import { extend } from "./extend.js";
import { pipe } from "./compose.js";
import { double } from "./test-utils.js";

describe("standalone extend()", () => {
  it("applied directly, mirrors the .extend() method", () => {
    const chain = (extend({ double })(pirell()) as any).double();
    const result = chain({ shape: ["i"], value: [1, 2, 3] });
    expect(result.value).toEqual([2, 4, 6]);
  });

  it("works on a data-bound Wrapper too", () => {
    // extend(ops) accepts either Deferred or Wrapper — same wiring mechanism
    const result = (extend({ double })(pirell([1, 2, 3])) as any).double()
      .value;
    expect(result).toEqual([2, 4, 6]);
  });

  it("accepts a single function", () => {
    const result = extend(double)(pirell([1, 2, 3]));
    expect(result.value).toEqual([2, 4, 6]);
  });

  it("single function works as a pipe step", () => {
    const fn = extend(double) as (x: any) => any;
    const result = pipe(pirell([1, 2, 3]), fn);
    expect(result.value).toEqual([2, 4, 6]);
  });
});
