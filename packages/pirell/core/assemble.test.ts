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

    expect(result.shape).toEqual(["i"]);
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

  it("chains multiple extends with shape transitions", () => {
    const ext1 = (pirell({ a: 1, b: 2 }) as any).extend({ toEntries });
    const ext2 = ext1.extend({ flattenEntries });
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
    expect(typeof chain).toBe("function");

    const result = chain({ shape: ["i"], value: [1, 2, 3] });
    expect(result.value).toBe(12); // (1+2+3)*2
  });

  it("works with object shape ['k', ...]", () => {
    const chain = (pirell() as any)
      .extend({ toEntries })
      .toEntries()
      .extend({ flattenEntries })
      .flattenEntries();
    expect(typeof chain).toBe("function");

    const result = chain({ shape: ["k"], value: { a: 1, b: 2 } });
    expect(result.shape).toEqual(["i"]);
    expect(result.value).toEqual([1, 2]);
  });

  it("works with nested shape ['k', 'i', ...]", () => {
    const chain = (pirell() as any)
      .extend({ sumValues })
      .sumValues()
      .extend({ toEntries })
      .toEntries();
    expect(typeof chain).toBe("function");

    const result = chain({
      shape: ["k", "i"],
      value: { a: [1, 2], b: [3, 4] },
    });
    expect(result.shape).toEqual(["i"]);
    expect(result.value).toEqual([
      ["a", 3],
      ["b", 7],
    ]);
  });
});

describe("Deferred.pipe (assembled)", () => {
  it("appends plain functions as steps without running them", () => {
    const chain = (pirell() as any).pipe(double, sumAll);
    expect(typeof chain).toBe("function");

    const result = chain({ shape: ["i"], value: [1, 2, 3] });
    expect(result.value).toBe(12);
  });

  it("pipes through shape transitions", () => {
    const chain = (pirell() as any).pipe(toEntries, flattenEntries, double);
    expect(typeof chain).toBe("function");

    const result = chain({ shape: ["k"], value: { a: 1, b: 2 } });
    expect(result.shape).toEqual(["i"]);
    expect(result.value).toEqual([2, 4]);
  });

  it("composes as a plain step inside compose(), mixed with a custom op", () => {
    const doubled: (data: any) => any = (pirell() as any)
      .extend({ double })
      .double();
    const run = compose(doubled, sumAll);

    const result = run({ shape: ["i"], value: [1, 2, 3] });
    expect(result.value).toBe(12);
  });
});

describe("Deferred.compose (assembled)", () => {
  it("appends a composed step without running it", () => {
    const chain = (pirell() as any).compose(double, sumAll);
    expect(typeof chain).toBe("function");

    const result = chain({ shape: ["i"], value: [1, 2, 3] });
    expect(result.value).toBe(12);
  });

  it("composes with shape transitions", () => {
    const chain = (pirell() as any).compose(toEntries, flattenEntries, double);
    expect(typeof chain).toBe("function");

    const result = chain({ shape: ["k"], value: { a: 1, b: 2 } });
    expect(result.shape).toEqual(["i"]);
    expect(result.value).toEqual([2, 4]);
  });
});
