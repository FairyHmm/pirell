import { describe, it, expect } from "vitest";
import { pirell } from "./assemble.js";
import { compose } from "./compose.js";
import { Wrapper } from "./wrapper.js";
import type { Pirell as PirellT } from "./types.js";

const double = (data: PirellT<any, number[]>) => ({
  shape: data.shape,
  value: data.value.map((n: number) => n * 2),
});
const sumAll = (data: PirellT<any, number[]>) => ({
  shape: [] as const,
  value: data.value.reduce((a: number, b: number) => a + b, 0),
});

describe("Wrapper.extend (assembled)", () => {
  it("wires a fluent method and rewraps the result", () => {
    const ext = (pirell([1, 2, 3]) as any).extend({ double });
    const result = ext.double();

    expect(result).toBeInstanceOf(Wrapper);
    expect(result.shape).toEqual(["i"]);
    expect(result.value).toEqual([2, 4, 6]);
  });
});

describe("Wrapper.pipe (assembled)", () => {
  it("applies plain functions immediately and rewraps", () => {
    const result = (pirell([1, 2, 3]) as any).pipe(double, sumAll);
    expect(result.value).toBe(12); // (1+2+3)*2
  });
});

describe("Wrapper.compose (assembled)", () => {
  it("applies plain functions immediately and rewraps", () => {
    const result = (pirell([1, 2, 3]) as any).compose(double, sumAll);
    expect(result.value).toBe(12);
  });
});

describe("Deferred.extend (assembled)", () => {
  it("builds a deferred, chainable, callable transform", () => {
    const chain = (pirell() as any)
      .extend({ double })
      .double()
      .extend({ sumAll })
      .sumAll();
    expect(typeof chain).toBe("function");

    const result = chain({ shape: ["i"], value: [1, 2, 3] });
    expect(result.value).toBe(12); // (1+2+3)*2
  });
});

describe("Deferred.pipe (assembled)", () => {
  it("appends plain functions as steps without running them", () => {
    const chain = (pirell() as any).pipe(double, sumAll);
    expect(typeof chain).toBe("function");

    const result = chain({ shape: ["i"], value: [1, 2, 3] });
    expect(result.value).toBe(12);
  });

  it("composes as a plain step inside compose(), mixed with a custom op", () => {
    const doubled: (data: any) => any = (pirell() as any)
      .extend({ double })
      .double();
    const run = compose(doubled, sumAll);

    const result = run({ shape: ["i"], value: [1, 2, 3] });
    expect(result.value).toBe(12);
  });
});

describe("Deferred.compose (assembled)", () => {
  it("appends a composed step without running it", () => {
    const chain = (pirell() as any).compose(double, sumAll);
    expect(typeof chain).toBe("function");

    const result = chain({ shape: ["i"], value: [1, 2, 3] });
    expect(result.value).toBe(12);
  });
});
