import { describe, it, expect } from "vitest";
import { pirell } from "./assemble.js";
import { compose } from "./compose.js";
import { Wrapper } from "./pirell.js";
import {
  double,
  sumAll,
  toEntries,
  sumValues,
  flattenEntries,
  stringifyValues,
} from "./test-utils.js";

describe("Wrapper.extend (assembled)", () => {
  it("wires a fluent method and rewraps the result", () => {
    const ext = (pirell([1, 2, 3]) as any).extend({ double });
    const result = ext.double();

    expect(result).toBeInstanceOf(Wrapper);
    expect(result.shape).toEqual(["i"]);
    expect(result.value).toEqual([2, 4, 6]);
  });

  it("works with object shape ['k', ...]", () => {
    const ext = (pirell({ a: 1, b: 2 }) as any).extend({
      toEntries,
    });
    const result = ext.toEntries();

    // toEntries output is Mixed<'i'>: outer dim is 'i', children non-uniform
    expect(result.shape[0].__mixed).toBe("i");
    expect(result.value).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
  });

  it("works with nested shape ['k', 'i', ...]", () => {
    const ext = (pirell({ a: [1, 2], b: [3, 4] }) as any).extend({
      sumValues,
    });
    const result = ext.sumValues();

    expect(result.shape).toEqual(["k"]);
    expect(result.value).toEqual({ a: 3, b: 7 });
  });

  it("chains extends on successive results", () => {
    const ext1 = (pirell({ a: 1, b: 2 }) as any).extend({ toEntries });
    const ext2 = ext1.toEntries().extend({ flattenEntries });
    const result = ext2.flattenEntries();

    expect(result.shape).toEqual(["i"]);
    expect(result.value).toEqual([1, 2]);
  });
});

describe("Wrapper.pipe (assembled)", () => {
  it("applies plain functions immediately and rewraps", () => {
    const result = (pirell([1, 2, 3]) as any).pipe(double, sumAll);
    expect(result.value).toBe(12); // (1+2+3)*2
  });

  it("pipes through shape transitions", () => {
    const result = (pirell({ a: 1, b: 2 }) as any).pipe(
      toEntries,
      flattenEntries,
      double,
    );
    expect(result.shape).toEqual(["i"]);
    expect(result.value).toEqual([2, 4]);
  });
});

describe("Wrapper.compose (assembled)", () => {
  it("applies plain functions immediately and rewraps", () => {
    const result = (pirell([1, 2, 3]) as any).compose(double, sumAll);
    expect(result.value).toBe(12);
  });

  it("composes with shape transitions", () => {
    const result = (pirell({ a: [1, 2], b: [3, 4] }) as any).compose(
      sumValues,
      toEntries,
      flattenEntries,
      double,
    );
    expect(result.shape).toEqual(["i"]);
    expect(result.value).toEqual([6, 14]);
  });
});

describe("Deferred.extend (assembled)", () => {
  it("builds a deferred, chainable, callable transform", () => {
    const chain = (pirell() as any)
      .extend({ double })
      .double()
      .extend({ sumAll })
      .sumAll();

    const result = chain(pirell([1, 2, 3]));
    expect(result.value).toBe(12); // (1+2+3)*2
  });

  it("works with object shape ['k', ...]", () => {
    const chain = (pirell() as any)
      .extend({ toEntries })
      .toEntries()
      .extend({ flattenEntries })
      .flattenEntries();

    const result = chain(pirell({ a: 1, b: 2 }));
    expect(result.value).toEqual([1, 2]);
  });

  it("works with nested shape ['k', 'i', ...]", () => {
    const chain = (pirell() as any)
      .extend({ sumValues })
      .sumValues()
      .extend({ toEntries })
      .toEntries();

    const result = chain(pirell({ a: [1, 2], b: [3, 4] }));
    expect(result.shape[0].__mixed).toBe("i");
    expect(result.value).toEqual([
      ["a", 3],
      ["b", 7],
    ]);
  });
});

describe("Deferred.pipe (assembled)", () => {
  it("applies steps and returns a result", () => {
    const chain = (pirell() as any).pipe(double, sumAll);

    const result = chain(pirell([1, 2, 3]));
    expect(result.value).toBe(12);
  });

  it("pipes through shape transitions", () => {
    const chain = (pirell() as any).pipe(toEntries, flattenEntries, double);

    const result = chain(pirell({ a: 1, b: 2 }));
    expect(result.value).toEqual([2, 4]);
  });

  it("composes as a plain step inside compose(), mixed with a custom op", () => {
    const doubled: (data: any) => any = (pirell() as any)
      .extend({ double })
      .double();
    const run = compose(doubled, sumAll);

    const result = run(pirell([1, 2, 3]));
    expect(result.value).toBe(12);
  });
});

describe("Deferred.compose (assembled)", () => {
  it("applies steps and returns a result", () => {
    const chain = (pirell() as any).compose(double, sumAll);

    const result = chain(pirell([1, 2, 3]));
    expect(result.value).toBe(12);
  });

  it("composes with shape transitions", () => {
    const chain = (pirell() as any).compose(toEntries, flattenEntries, double);

    const result = chain(pirell({ a: 1, b: 2 }));
    expect(result.value).toEqual([2, 4]);
  });
});

describe("Mixed<'k'> (k... shaped nodes)", () => {
  it("Wrapper: accepts an object with non-uniform values via Mixed<'k'> op", () => {
    const data = { name: "alice", age: 30, active: true };
    const ext = (pirell(data) as any).extend({ stringifyValues });
    const result = ext.stringifyValues();

    expect(result.shape).toEqual(["k"]);
    expect(result.value).toEqual({ name: "alice", age: "30", active: "true" });
  });

  it("Deferred: pipes Mixed<'k'> op over a non-uniform object", () => {
    const chain = (pirell() as any).pipe(stringifyValues);

    const result = chain(pirell({ x: 1, y: "hello", z: false }));
    expect(result.value).toEqual({ x: "1", y: "hello", z: "false" });
  });

  it("chains Mixed<'k'> -> toEntries -> flattenEntries in a pipe", () => {
    const result = (pirell({ id: 42, label: "foo" }) as any).pipe(
      stringifyValues,
      toEntries,
      flattenEntries,
    );

    expect(result.shape).toEqual(["i"]);
    expect(result.value).toEqual(["42", "foo"]);
  });
});
