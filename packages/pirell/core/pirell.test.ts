import { describe, it, expect } from "vitest";
import { pirell } from "./pirell.js";
import { Wrapper } from "./pirell.js";

describe("pirell()", () => {
  it("with data returns a data-bound Wrapper", () => {
    const w = pirell([1, 2, 3]);
    expect(w).toBeInstanceOf(Wrapper);
    expect(w.value).toEqual([1, 2, 3]);
  });

  it("with no args returns a bare callable that threads data through", () => {
    const run = pirell();
    expect(typeof run).toBe("function");

    const data = { shape: ["i"] as const, value: [1, 2, 3] };
    // Bare pirell() declares Pirell<[], undefined> — real typing comes from the assembled surface. Cast exercises runtime identity.
    expect((run as any)(data)).toEqual(data); // no steps: identity
  });

  // .extend() and .pipe() are attached by the assembly layer, not by
  // the bare primitives here — see core/assemble.test.ts.
});
