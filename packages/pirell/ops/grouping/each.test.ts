import { describe, it, expect } from "vitest";
import { pirell } from "../index.js";
import { each } from "./each.js";
import { pipe } from "@pirell/core";
import type { Op } from "@pirell/core";

// Test-local double — mirrors core's fixture op without reaching into
// core's private ops dir.
const double: Op<[["i", number]], [["i", number]]> = (data) =>
  data.map((n) => n * 2);

// A sibling Keyed → Indexed op, mirroring a package's `values`: claims
// open-keyed input so it re-wires onto `each`'s output shape.
const listValues: Op<["k", "..."], ["i", "..."]> = (data) =>
  Object.values(data);

describe("each", () => {
  it("broadcasts an op across every record value", () => {
    const result = pirell({ a: [3, 1], b: [2] }).each(double).value;
    expect(result).toEqual({ a: [6, 2], b: [4] });
  });

  it("chains: sibling ops re-wire onto the keyed result", () => {
    // `each` ships on pirell() — only listValues is new.
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
});
