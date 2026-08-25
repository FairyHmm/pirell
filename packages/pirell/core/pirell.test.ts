import { describe, it, expect } from "vitest";
import { pirell } from "./pirell.js";
import { pipe } from "./pipe.js";
import { Wrapper } from "./wrapper.js";
import type { Pirell as PirellT } from "./types.js";

const double = (data: PirellT<any, number[]>) => ({
  shape: data.shape,
  value: data.value.map((n: number) => n * 2),
});
const sumAll = (data: PirellT<any, number[]>) => ({
  shape: [],
  value: data.value.reduce((a: number, b: number) => a + b, 0),
});

describe("pirell()", () => {
  it("with data returns a data-bound Wrapper", () => {
    const w = pirell([1, 2, 3]);
    expect(w).toBeInstanceOf(Wrapper);
    expect(w.value).toEqual([1, 2, 3]);
  });

  // Deferred.extend() was stripped in the HANDOFF refactor (step 2) —
  // .extend() now lives on the assembled surface from core/index.ts, not
  // on the bare pirell() callable. Rewrite against that surface in step 5.
  it.skip("with no args builds a deferred, chainable, callable transform", () => {
    const chain = (pirell() as any)
      .extend({ double })
      .double()
      .extend({ sumAll })
      .sumAll();
    expect(typeof chain).toBe("function");

    const result = chain({ shape: ["i"], value: [1, 2, 3] });
    expect(result.value).toBe(12); // (1+2+3)*2
  });

  it.skip("composes as a plain step inside pipe(), mixed with a custom op", () => {
    const doubled = (pirell() as any).extend({ double }).double();
    const run = pipe(doubled, sumAll);

    const result = run({ shape: ["i"], value: [1, 2, 3] });
    expect(result.value).toBe(12);
  });
});
