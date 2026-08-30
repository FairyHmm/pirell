import { describe, it, expect } from "vitest";
import { pirell } from "./assemble.js";
import {
  double,
  sumAll,
  toEntries,
  sumValues,
  flattenEntries,
  stringifyValues,
} from "./test-utils.js";

describe("Wrapper.extend (data-bound)", () => {
  it("wires a fluent method and returns a surface holding the raw result", () => {
    const ext = (pirell([1, 2, 3]) as any).extend({ double });
    const result = ext.double();

    expect(result.value).toEqual([2, 4, 6]);
  });

  it("works with object shape [Keyed, ...]", () => {
    const result = (pirell({ a: 1, b: 2 }) as any)
      .extend({ toEntries })
      .toEntries();

    expect(result.value).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
  });

  it("works with nested shape [Keyed, Indexed, ...]", () => {
    const result = (pirell({ a: [1, 2], b: [3, 4] }) as any)
      .extend({ sumValues })
      .sumValues();

    expect(result.value).toEqual({ a: 3, b: 7 });
  });

  it("chains extends on successive results", () => {
    const entries = (pirell({ a: 1, b: 2 }) as any)
      .extend({ toEntries })
      .toEntries();
    const result = entries.extend({ flattenEntries }).flattenEntries();

    expect(result.value).toEqual([1, 2]);
  });
});

describe("Wrapper.pipe (data-bound)", () => {
  it("applies plain functions immediately and returns the raw result", () => {
    const result = (pirell([1, 2, 3]) as any).pipe(double, sumAll);
    expect(result).toBe(12); // (1+2+3)*2
  });

  it("pipes through shape transitions", () => {
    const result = (pirell({ a: 1, b: 2 }) as any).pipe(
      toEntries,
      flattenEntries,
      double,
    );
    expect(result).toEqual([2, 4]);
  });
});

describe("Wrapper.compose (data-bound)", () => {
  it("applies plain functions immediately and returns the raw result", () => {
    const result = (pirell([1, 2, 3]) as any).compose(double, sumAll);
    expect(result).toBe(12);
  });

  it("composes with shape transitions", () => {
    const result = (pirell({ a: [1, 2], b: [3, 4] }) as any).compose(
      sumValues,
      toEntries,
      flattenEntries,
      double,
    );
    expect(result).toEqual([6, 14]);
  });
});

describe("Deferred (pirell()): builder surfaces", () => {
  it("builds a fluent transform, callable with raw JSON", () => {
    const chain = (pirell() as any)
      .extend({ double })
      .double()
      .extend({ sumAll })
      .sumAll();

    const result = chain([1, 2, 3]);
    expect(result.value).toBe(12); // (1+2+3)*2
  });

  it("works with object shape [Keyed, ...]", () => {
    const chain = (pirell() as any)
      .extend({ toEntries })
      .toEntries()
      .extend({ flattenEntries })
      .flattenEntries();

    const result = chain({ a: 1, b: 2 });
    expect(result.value).toEqual([1, 2]);
  });

  it("works with nested shape [Keyed, Indexed, ...]", () => {
    const chain = (pirell() as any)
      .extend({ sumValues })
      .sumValues()
      .extend({ toEntries })
      .toEntries();

    const result = chain({ a: [1, 2], b: [3, 4] });
    expect(result.value).toEqual([
      ["a", 3],
      ["b", 7],
    ]);
  });
});

describe("Deferred.pipe / compose (lazy)", () => {
  it("pipe builds a chain, callable with raw JSON", () => {
    const chain = (pirell() as any).pipe(double, sumAll);

    const result = chain([1, 2, 3]);
    expect(result.value).toBe(12);
  });

  it("pipe through shape transitions", () => {
    const chain = (pirell() as any).pipe(toEntries, flattenEntries, double);

    const result = chain({ a: 1, b: 2 });
    expect(result.value).toEqual([2, 4]);
  });

  it("compose builds a chain, callable with raw JSON", () => {
    const chain = (pirell() as any).compose(double, sumAll);

    const result = chain([1, 2, 3]);
    expect(result.value).toBe(12);
  });

  it("compose with shape transitions", () => {
    const chain = (pirell() as any).compose(toEntries, flattenEntries, double);

    const result = chain({ a: 1, b: 2 });
    expect(result.value).toEqual([2, 4]);
  });
});

describe("splitting a chain in two (value reuse)", () => {
  it("one-line chain equals the split chain", () => {
    const entry = (pirell() as any).extend({ double, sumAll });

    const oneLine = entry([1, 2, 3]).double().sumAll();

    const res1 = entry([1, 2, 3]).double();
    const split = entry(res1).sumAll();

    expect(oneLine.value).toBe(12);
    expect(res1.value).toEqual([2, 4, 6]);
    expect(split.value).toBe(12);
  });
});

describe("Keyed<unknown, 'mixed'> (non-uniform keyed nodes)", () => {
  it("Wrapper: accepts an object with non-uniform values via a mixed-keyed op", () => {
    const data = { name: "alice", age: 30, active: true };
    const result = (pirell(data) as any)
      .extend({ stringifyValues })
      .stringifyValues();

    expect(result.value).toEqual({ name: "alice", age: "30", active: "true" });
  });

  it("Deferred: pipes a mixed-keyed op over a non-uniform object", () => {
    const chain = (pirell() as any).pipe(stringifyValues);

    const result = chain({ x: 1, y: "hello", z: false });
    expect(result.value).toEqual({ x: "1", y: "hello", z: "false" });
  });

  it("chains mixed-keyed -> toEntries -> flattenEntries in a pipe", () => {
    const result = (pirell({ id: 42, label: "foo" }) as any).pipe(
      stringifyValues,
      toEntries,
      flattenEntries,
    );

    expect(result).toEqual(["42", "foo"]);
  });
});
