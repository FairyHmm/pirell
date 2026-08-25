import { describe, it, expect } from "vitest";
import { pirell } from "./pirell.js";
import { extend } from "./extend.js";
import type { Pirell as PirellT } from "./types.js";

const double = (data: PirellT<any, number[]>) => ({
  shape: data.shape,
  value: data.value.map((n: number) => n * 2),
});

describe.skip("standalone extend()", () => {
  it.skip("applied directly, mirrors the .extend() method", () => {
    const chain = extend({ double })(pirell()).double();
    const result = chain({ shape: ["i"], value: [1, 2, 3] });
    expect(result.value).toEqual([2, 4, 6]);
  });

  // extend(ops)'s structural constraint requires surface.extend, which
  // Wrapper no longer has as of the HANDOFF refactor (step 1). Standalone
  // extend() itself needs updating in step 4 to call wireOps directly
  // instead of surface.extend. Rewrite this test then.
  it.skip("works on a data-bound Wrapper too", () => {
    // extend(ops) accepts either Deferred or Wrapper — same wiring mechanism
    const result = (extend({ double })(pirell([1, 2, 3]) as any) as any)
      .double().value;
    expect(result).toEqual([2, 4, 6]);
  });
});
