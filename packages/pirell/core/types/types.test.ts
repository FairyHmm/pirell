import { describe, expectTypeOf, it } from "vitest";
import type { MatchesIn } from "./match.js";

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
});
