import { describe, it, expect } from "vitest";
import { pirell } from "../index.js";
import { each } from "./each.js";
import { pipe } from "./compose.js";
import { double } from "../ops/fixture-ops.js";
import type { Op } from "../types/base.js";

// A sibling Keyed → Indexed op, mirroring a package's `values`: claims
// open-keyed input so it re-wires onto `each`'s output shape.
const listValues: Op<["k", "..."], ["i", "..."]> = (data) =>
  Object.values(data as Record<string, unknown>);

describe("each", () => {
  it("broadcasts an op across every record value", () => {
    const result = pirell({ a: [3, 1], b: [2] }).each(double).value;
    expect(result).toEqual({ a: [6, 2], b: [4] });
  });

  it("chains: sibling ops re-wire onto the keyed result", () => {
    // `each` is already a core op on pirell() — only listValues is new.
    const values = pirell({ a: [3, 1], b: [2] })
      .extend({ listValues })
      .each(double)
      .listValues().value;
    expect(values).toEqual([[6, 2], [4]]);
  });

  it("binds after data, just like any fluent method", () => {
    const result = pirell({ a: [1], b: [2, 3] }).each(double).value;
    expect(result).toEqual({ a: [2], b: [4, 6] });
  });

  it("works standalone with a functional op", () => {
    const result = each(double)({ a: [3, 1], b: [2] });
    expect(result).toEqual({ a: [6, 2], b: [4] });
  });

  it("composes as a bare stage in pipe", () => {
    const result = pipe({ a: [3, 1], b: [2] }, each(double));
    expect(result).toEqual({ a: [6, 2], b: [4] });
  });

  it("rejects non-keyed data at the type level", () => {
    // Type check only — never runs
    if (false) {
      const nums = [1, 2, 3];
      // @ts-expect-error -- each expects Keyed, not ["i"]
      pirell(nums).each(double);
    }
  });
});
