import { describe, it, expect } from "vitest";
import { pirell } from "./assemble.js";
import { extend } from "./extend.js";
import { pipe } from "./compose.js";
import { double, nth } from "../ops/fixture-ops.js";

describe("standalone extend()", () => {
  it("applied directly, mirrors the .extend() method (Deferred)", () => {
    const chain = (extend({ double })(pirell()) as any).double();
    const result = chain([1, 2, 3]);
    expect(result.value).toEqual([2, 4, 6]);
  });

  it("works on a data-bound Wrapper too", () => {
    // extend(ops) accepts either Deferred or Wrapper — same wiring mechanism
    const result = (extend({ double })(pirell([1, 2, 3])) as any).double()
      .value;
    expect(result).toEqual([2, 4, 6]);
  });

  it("single function receives the raw value and yields the raw result", () => {
    // extend(fn) unwraps a surface argument to its .value and returns
    // whatever fn returns — raw JSON, no wrapper (raw-data ops contract).
    const result = extend(double)(pirell([1, 2, 3]));
    expect(result).toEqual([2, 4, 6]);
  });

  it("single function works as a pipe step", () => {
    const fn = extend(double) as (x: any) => any;
    const result = pipe(pirell([1, 2, 3]), fn);
    expect(result).toEqual([2, 4, 6]);
  });

  it("rejects a parameterized op at the type level", () => {
    // Type check only — never runs (would throw at runtime too, see below).
    if (false) {
      // @ts-expect-error -- nth has Args=[number]; extend(fn) only accepts
      // Args=[] since it calls fn() with no arguments to reach (data) => R.
      extend(nth);
    }
  });

  it("rejects a parameterized op at runtime too, with an actionable message", () => {
    // Same call, forced past the type system (e.g. a JS caller, or `as any`)
    // — the arity check is a real runtime guard, not just a type-level one.
    expect(() => (extend as any)(nth)([1, 2, 3])).toThrow(
      /parameterized ops aren't supported/,
    );
  });
});
