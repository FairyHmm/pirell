import { describe, expectTypeOf, it } from "vitest";
import type { MatchesIn, ShapeOf } from "./match.js";

// Named-field shapes for testing both acceptance and rejection.
type UserShape = ["k...", { name: string; age: number }];
type OrderShape = ["k...", { id: number; total: number }];

describe("shape matching: MatchesIn", () => {
  it("exact match: shapes with identical structure pass", () => {
    type Result = MatchesIn<["i"], ["i"]>;
    expectTypeOf<Result>().toEqualTypeOf<["i"]>();
  });

  it("shape mismatch: different dimension types fail", () => {
    type Result = MatchesIn<["i"], ["k"]>;
    expectTypeOf<Result>().toEqualTypeOf<never>();
  });

  it("open tail: [...] matches any suffix in Actual", () => {
    type Result = MatchesIn<["i", "..."], ["i", "k", "i"]>;
    expectTypeOf<Result>().toEqualTypeOf<["i", "k", "i"]>();
  });

  it("closed tail: exact length is required, extra elements fail", () => {
    type Result = MatchesIn<["i"], ["i", "k"]>;
    expectTypeOf<Result>().toEqualTypeOf<never>();
  });

  it("named shapes: differing field types reject", () => {
    type Result = MatchesIn<[UserShape], [OrderShape]>;
    expectTypeOf<Result>().toEqualTypeOf<never>();
  });

  it("named shape acceptance: matching fields pass", () => {
    type Result = MatchesIn<
      [UserShape],
      [["k...", { name: string; age: number }]]
    >;
    expectTypeOf<Result>().toEqualTypeOf<
      [["k...", { name: string; age: number }]]
    >();
  });

  it("depth mismatch: extra dimensions fail", () => {
    type Result = MatchesIn<["k", "i"], ["k", "i", "..."]>;
    expectTypeOf<Result>().toEqualTypeOf<never>();
  });

  it("open tail accepts truncation: 0 extra dimensions in Actual", () => {
    type Result = MatchesIn<["k", "i", "..."], ["k", "i"]>;
    expectTypeOf<Result>().toEqualTypeOf<["k", "i"]>();
  });

  // A bare Dim/MixedTag In makes no claim beyond dim+kind — a more
  // detailed Actual satisfies it (PLAN.md: "more detail is welcome if the
  // op doesn't need it"). The reverse must still fail: a declared In makes
  // a real claim, so a bare or less-specific Actual can't satisfy it.
  it("bare In accepts a Branch-declared Actual of the same dim", () => {
    type Result = MatchesIn<["k"], [["k", number]]>;
    expectTypeOf<Result>().toEqualTypeOf<[["k", number]]>();
  });

  it("declared In still rejects a bare Actual (reverse direction)", () => {
    type Result = MatchesIn<[["k", number]], ["k"]>;
    expectTypeOf<Result>().toEqualTypeOf<never>();
  });

  it("bare In accepts a Variants-declared mixed Actual of the same dim", () => {
    type Result = MatchesIn<["i..."], [["i...", [string, number]]]>;
    expectTypeOf<Result>().toEqualTypeOf<[["i...", [string, number]]]>();
  });

  it("leaf vs mixed kind still distinct even when In is bare", () => {
    type Result = MatchesIn<["i"], ["i..."]>;
    expectTypeOf<Result>().toEqualTypeOf<never>();
  });
});

describe("shape inference: ShapeOf", () => {
  // A non-union primitive array element is concrete enough to encode as a
  // Branch directly — data has no inherent shape (ARCHITECTURE.md); this
  // only widens what a bare literal's own static type can prove to the op
  // checking it, so ops with a real element-type claim (e.g. double's
  // arithmetic body) can be satisfied by a bare literal, no `as Raw<S>`.
  it("array of a concrete primitive derives a Branch leaf, not bare 'i'", () => {
    type Result = ShapeOf<number[]>;
    expectTypeOf<Result>().toEqualTypeOf<[["i", number]]>();
  });

  it("object with concrete primitive values derives a Branch leaf, not bare 'k'", () => {
    type Result = ShapeOf<Record<string, number>>;
    expectTypeOf<Result>().toEqualTypeOf<[["k", number]]>();
  });

  it("union element still derives the mixed tail, not a Branch", () => {
    type Result = ShapeOf<(number | string)[]>;
    expectTypeOf<Result>().toEqualTypeOf<["i..."]>();
  });

  it("array-of-array (container) recurses, carrying the leaf Branch through", () => {
    type Result = ShapeOf<number[][]>;
    expectTypeOf<Result>().toEqualTypeOf<["i", ["i", number]]>();
  });

  it("unknown-valued object stays opaque (no Branch, no crash)", () => {
    type Result = ShapeOf<Record<string, unknown>>;
    expectTypeOf<Result>().toEqualTypeOf<["k"]>();
  });

  // Regression: Raw<S>'s brand is `[__shapeBrand]?: S`, optional so a bare
  // literal can be `as Raw<S>`-cast. That optionality means an
  // index-signature object type (Record<string, T>) vacuously "has" the
  // property too, so `D extends Raw<infer S>` incorrectly matched ANY
  // Record<string, T> and inferred S as unconstrained Shape — collapsing
  // ShapeOf<Record<string,T>> to the whole Shape union instead of a real
  // shape, for every T, silently. Named-property object types never hit
  // this (only index-signature types vacuously satisfy the symbol key).
  it("index-signature object does not vacuously match Raw's optional brand", () => {
    type Result = ShapeOf<Record<string, number>>;
    // Must be the concrete derived shape, not the unconstrained Shape union
    // Raw<infer S> would produce if it wrongly matched.
    expectTypeOf<Result>().toEqualTypeOf<[["k", number]]>();
    expectTypeOf<Result>().not.toEqualTypeOf<
      import("./types.js").Shape
    >();
  });
});
