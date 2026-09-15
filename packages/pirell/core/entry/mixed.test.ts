import { describe, it, expect } from "vitest";
import { pirell } from "../index.js";
import {
  toEntries,
  flattenEntries,
  stringifyValues,
} from "../ops/fixture-ops.js";

describe("Keyed<unknown, 'mixed'> (non-uniform keyed nodes)", () => {
  it("bound: accepts an object with non-uniform values via a mixed-keyed op", () => {
    const data = { name: "alice", age: 30, active: true };
    const result = pirell(data).extend({ stringifyValues }).stringifyValues();

    expect(result.value).toEqual({ name: "alice", age: "30", active: "true" });
  });

  it("Deferred: pipes a mixed-keyed op over a non-uniform object", () => {
    const chain = pirell().pipe(stringifyValues);

    const result = chain({ x: 1, y: "hello", z: false });
    expect(result.value).toEqual({ x: "1", y: "hello", z: "false" });
  });

  it("chains mixed-keyed -> toEntries -> flattenEntries in a pipe", () => {
    const result = pirell({ id: 42, label: "foo" }).pipe(
      stringifyValues,
      toEntries,
      flattenEntries,
    ).value;

    expect(result).toEqual(["42", "foo"]);
  });
});
