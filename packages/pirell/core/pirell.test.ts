import { describe, it, expect } from "vitest";
import { pirell } from "./pirell.js";
import { Wrapper } from "./pirell.js";

describe("pirell()", () => {
  it("with array returns Wrapper with inferred ['i'] shape", () => {
    const w = pirell([1, 2, 3]);
    expect(w).toBeInstanceOf(Wrapper);
    expect(w.shape).toEqual(["i"]);
    expect(w.value).toEqual([1, 2, 3]);
  });

  it("with object returns Wrapper with inferred ['k'] shape", () => {
    const w = pirell({ a: 1, b: 2 });
    expect(w).toBeInstanceOf(Wrapper);
    expect(w.shape).toEqual(["k"]);
    expect(w.value).toEqual({ a: 1, b: 2 });
  });

  it("with nested object infers nested shape", () => {
    const w = pirell({ a: [1, 2], b: [3, 4] });
    expect(w.shape).toEqual(["k", "i"]);
  });

  it("with null returns empty shape", () => {
    const w = pirell(null);
    expect(w.shape).toEqual([]);
    expect(w.value).toBeNull();
  });

  it("with primitive returns empty shape", () => {
    const w = pirell(42);
    expect(w.shape).toEqual([]);
    expect(w.value).toBe(42);
  });

  it("with empty array returns ['i']", () => {
    const w = pirell([]);
    expect(w.shape).toEqual(["i"]);
    expect(w.value).toEqual([]);
  });

  it("with empty object returns ['k']", () => {
    const w = pirell({});
    expect(w.shape).toEqual(["k"]);
    expect(w.value).toEqual({});
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
