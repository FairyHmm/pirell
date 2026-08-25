import { describe, it, expect } from "vitest";
import { Wrapper } from "./wrapper.js";

// Wrapper.extend() was stripped in the HANDOFF refactor (step 1) — .extend()
// now lives on the assembled surface from core/index.ts, not on Wrapper
// itself. Rewrite against that surface in step 5.
describe.skip("Wrapper.extend", () => {
  it("wires a fluent method and rewraps the result", () => {
    const w = new Wrapper(["i"] as const, [1, 2, 3]);
    const double = (data: { shape: readonly ["i"]; value: number[] }) => ({
      shape: data.shape,
      value: data.value.map((n) => n * 2),
    });

    const ext = (w as any).extend({ double });
    const result = ext.double();

    expect(result).toBeInstanceOf(Wrapper);
    expect(result.shape).toEqual(["i"]);
    expect(result.value).toEqual([2, 4, 6]);
  });
});
