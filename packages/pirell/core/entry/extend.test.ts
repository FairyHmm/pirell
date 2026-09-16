import { describe, it, expect } from "vitest";
import { pirell } from "../index.js";
import { extend } from "./extend.js";
import { pipe } from "./compose.js";
import { double, nth } from "../ops/fixture-ops.js";

describe("standalone extend()", () => {
  it("applied directly, mirrors the .extend() method (Deferred)", () => {
    const chain = extend({ double })(pirell()).double();
    const result = chain([1, 2, 3]);
    expect(result.value).toEqual([2, 4, 6]);
  });

  it("works on a data-bound surface too", () => {
    // extend(ops) accepts either a deferred or a data-bound surface —
    // same wiring mechanism
    const result = extend({ double })(pirell([1, 2, 3])).double().value;
    expect(result).toEqual([2, 4, 6]);
  });

  it("single function receives the raw value and yields the raw result", () => {
    // extend(fn) unwraps a surface argument to its .value and returns
    // whatever fn returns — raw JSON, no wrapper (raw-data ops contract).
    const result = extend(double)(pirell([1, 2, 3]));
    expect(result).toEqual([2, 4, 6]);
  });

  it("single function works as a pipe step", () => {
    const fn: (x: unknown) => number[] = extend(double);
    const result = pipe(pirell([1, 2, 3]), fn);
    expect(result).toEqual([2, 4, 6]);
  });

  it("rejects a parameterized op at runtime too, with an actionable message", () => {
    // Same call, forced past the type system (e.g. a JS caller, or `as any`)
    // — the arity check is a real runtime guard, not just a type-level one.
    // FINDING (deferred): running past the type-level rejection needs an
    // escape hatch (design pending, per audit) — compiles to an error for now.
    expect(() => extend(nth)([1, 2, 3])).toThrow(
      /parameterized ops aren't supported/,
    );
  });
});
