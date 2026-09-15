import { describe, it, expect, expectTypeOf } from "vitest";
import { pirell } from "../index.js";
import {
  double,
  sumAll,
  toEntries,
  entriesToObject,
  sumValues,
  flattenEntries,
  take,
  doubleOpen,
} from "../ops/fixture-ops.js";

describe("bound-surface .extend()", () => {
  it("wires a fluent method and returns a surface holding the raw result", () => {
    const ext = pirell([1, 2, 3]).extend({ double });
    const result = ext.double();

    expect(result.value).toEqual([2, 4, 6]);
  });

  it("works with object shape [Keyed, ...]", () => {
    const result = pirell({ a: 1, b: 2 }).extend({ toEntries }).toEntries();

    expect(result.value).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
  });

  it("works with nested shape [Keyed, Indexed, ...]", () => {
    const result = pirell({ a: [1, 2], b: [3, 4] })
      .extend({ sumValues })
      .sumValues();

    expect(result.value).toEqual({ a: 3, b: 7 });
  });

  it("chains extends on successive results", () => {
    const entries = pirell({ a: 1, b: 2 }).extend({ toEntries }).toEntries();
    const result = entries.extend({ flattenEntries }).flattenEntries();

    expect(result.value).toEqual([1, 2]);
  });

  // Perf finding (PLAN.md "shared ops identity"): .extend()'s per-site
  // type cost (~36/site, HANDOFF Finding 5) comes from Ops being
  // inferred as a FRESH anonymous type at each call site's object
  // literal, not from genericity itself — a shared `const` reference
  // passed to multiple .extend() calls collapses to ~0/site marginal
  // (verified: perf/scratch-final.mts). This test guards the runtime
  // and narrowing behavior stay correct under that pattern.
  it("a shared, reused ops object behaves identically to a fresh literal per call", () => {
    const stdOps = { double, sumAll };
    const a = pirell([1, 2, 3]).extend(stdOps).double();
    const b = pirell([4, 5, 6]).extend(stdOps).double();

    expect(a.value).toEqual([2, 4, 6]);
    expect(b.value).toEqual([8, 10, 12]);
    // Siblings still wired and re-checked fresh off the shared object,
    // same as the fresh-literal path.
    expectTypeOf(a.sumAll).not.toBeNever();
  });
});

// See PLAN.md "relocate .extend()'s shape check onto Fluent/call-site"
// for the overload-collision bug these tests guard against.
describe("bound-surface .extend with multiple ops registered together", () => {
  it("calling the op that fits the CURRENT shape succeeds", () => {
    const data: [string, number][] = [
      ["a", 1],
      ["b", 2],
    ];
    const twoOp = pirell(data).extend({ entriesToObject, toEntries });
    const result = twoOp.entriesToObject();

    expect(result.value).toEqual({ a: 1, b: 2 });
  });

  it("the fitting op's result is NOT a union across the registered ops' Outs", () => {
    const twoOp = pirell([1, 2, 3]).extend({ double, toEntries });
    const result = twoOp.double();
    // double's own Out, not a union: siblings stay wired (re-checked
    // fresh), matching builders.ts threading `ops` through unchanged.
    expect(result.value).toEqual([2, 4, 6]);
    expectTypeOf(result.double).not.toBeNever();
  });

  it("calling in the correct order chains through cleanly", () => {
    const data = [
      ["a", 1],
      ["b", 2],
    ];
    const twoOp = pirell(data).extend({ entriesToObject, toEntries });
    // toEntries was registered alongside entriesToObject, so it's already
    // wired on the narrowed result — no need to re-.extend() it.
    const result = twoOp.entriesToObject().toEntries();

    expect(result.value).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
  });
});

// builders.ts runOp resolves a zero-arg fluent call by result: data ops
// return it directly; factories fed the data yield the data stage (a
// function), so they're re-called plain to apply to the data instead.
describe("bound-surface .extend zero-arg resolution", () => {
  it("applies an optional-arg factory as op()(data)", () => {
    const result = pirell([1, 2, 3]).extend({ take }).take();

    expect(result.value).toEqual([1, 2, 3]);
  });

  it("applies the same factory with its argument as op(arg)(data)", () => {
    const result = pirell([1, 2, 3]).extend({ take }).take(2);

    expect(result.value).toEqual([1, 2]);
  });

  it("data ops still take the direct zero-arg path", () => {
    const result = pirell([1, 2, 3]).extend({ sumAll }).sumAll();

    expect(result.value).toBe(6);
  });
});

describe("bound-surface .pipe()", () => {
  it("applies functions and returns a surface", () => {
    const result = pirell([1, 2, 3]).pipe(double, sumAll).value;
    expect(result).toBe(12); // (1+2+3)*2
  });

  it("pipes through shape transitions", () => {
    const result = pirell({ a: 1, b: 2 }).pipe(
      toEntries,
      flattenEntries,
      doubleOpen,
    ).value;
    expect(result).toEqual([2, 4]);
  });
});

describe("bound-surface .compose()", () => {
  it("applies functions and returns a surface", () => {
    const result = pirell([1, 2, 3]).compose(double, sumAll).value;
    expect(result).toBe(12);
  });

  it("pipes through shape transitions", () => {
    const result = pirell({ a: 1, b: 2 }).compose(
      toEntries,
      flattenEntries,
      doubleOpen,
    ).value;
    expect(result).toEqual([2, 4]);
  });
});
