import { describe, it, expect } from "vitest";
import { compose, pipe } from "./compose.js";
import type { Raw } from "../types/types.js";
import {
  double,
  sumAll,
  toEntries,
  flattenEntries,
} from "../ops/fixture-ops.js";

describe("compose", () => {
  it("threads a value through a sequence of unary functions", () => {
    const inc = (n: number) => n + 1;
    const double = (n: number) => n * 2;
    const toString = (n: number) => `n=${n}`;

    const run = compose(inc, double, toString);

    expect(run(1)).toBe("n=4"); // (1+1)*2
  });

  it("returns a plain function, not a bound chain", () => {
    const run = compose((n: number) => n + 1);
    expect(typeof run).toBe("function");
    expect(run(5)).toBe(6);
  });

  it("supports arbitrary chain length", () => {
    const run = compose(
      (n: number) => n + 1,
      (n: number) => n * 2,
      (n: number) => n - 3,
      (n: number) => `${n}`,
      (s: string) => s.length,
      (n: number) => n > 0,
    );
    expect(run(1)).toBe(true);
  });

  it("rejects a mismatched chain at the type level", () => {
    const toString = (n: number) => `${n}`;
    const inc = (n: number) => n + 1;
    // @ts-expect-error -- toString's output (string) doesn't match inc's input (number)
    compose(toString, inc);
  });
});

describe("pipe", () => {
  it("applies a sequence of unary functions to data immediately", () => {
    const inc = (n: number) => n + 1;
    const double = (n: number) => n * 2;
    const toString = (n: number) => `n=${n}`;

    expect(pipe(1, inc, double, toString)).toBe("n=4"); // (1+1)*2
  });

  it("returns the result, not a function", () => {
    expect(pipe(5, (n: number) => n + 1)).toBe(6);
  });

  it("supports arbitrary chain length", () => {
    const result = pipe(
      1,
      (n: number) => n + 1,
      (n: number) => n * 2,
      (n: number) => n - 3,
      (n: number) => `${n}`,
      (s: string) => s.length,
      (n: number) => n > 0,
    );
    expect(result).toBe(true);
  });

  it("rejects a mismatched chain at the type level", () => {
    const toString = (n: number) => `${n}`;
    const inc = (n: number) => n + 1;
    // @ts-expect-error -- toString's output (string) doesn't match inc's input (number)
    pipe(1, toString, inc);
  });
});

// pipe/compose also integrate directly with pirell Ops (see shape-inference.md).
// Kept here, not assemble.test.ts: assemble only wires surfaces together.
describe("standalone pipe/compose with pirell Ops", () => {
  it("pipe(data, fns) works directly on raw JSON", () => {
    const result = pipe([1, 2, 3] as Raw<["i"]>, double, sumAll);
    expect(result).toBe(12);
  });

  it("compose(fns)(data) works directly on raw JSON", () => {
    const result = compose(double, sumAll)([1, 2, 3] as Raw<["i"]>);
    expect(result).toBe(12);
  });

  it("pipe shape-gates a bare literal, no cast", () => {
    // No `as Raw<...>` — the Op-first overload checks the data's own
    // derived shape against the first op's In.
    const flat = pipe({ a: 1, b: 2 }, toEntries, flattenEntries);
    expect(flat).toEqual([1, 2]);
    const numbers = pipe({ a: 1, b: 2 }, toEntries, flattenEntries, double);
    expect(numbers).toEqual([2, 4]);
  });

  it("compose with a prior op's raw output, no cast", () => {
    // compose yields (data: Raw<In>) => Raw<Out>; an object literal can't
    // assign to the Raw<["k"]> brand (excess-property check), so it is fed
    // by a prior op's raw output instead — the cast-free compose path.
    const entries = toEntries()({ a: 1, b: 2 }) as Raw<["i", "i..."]>;
    const result = compose(flattenEntries, double)(entries);
    expect(result).toEqual([2, 4]);
  });
});

describe("standalone pipe/compose shape rejection (compile-time)", () => {
  it("rejects bare array data into an op expecting a keyed shape", () => {
    // Type check only — never runs.
    if (false) {
      // @ts-expect-error toEntries expects ["k"], not the derived ["i"]
      pipe([1, 2, 3], toEntries);
    }
  });

  it("rejects keyed data into an op expecting an indexed shape", () => {
    // Type check only — never runs.
    if (false) {
      // @ts-expect-error double expects ["i"], not the derived ["k"]
      pipe({ a: 1 }, double);
    }
  });

  it("rejects a compose link whose Out can't feed the next In", () => {
    // Type check only — never runs.
    if (false) {
      // @ts-expect-error double Out ["i"] can't feed toEntries In ["k"]
      compose(double, toEntries);
      // @ts-expect-error double Out ["i"] can't feed flattenEntries In ["i","i..."]
      compose(double, flattenEntries);
    }
  });

  it("rejects a chain narrowed by a mismatched final element", () => {
    // Type check only — never runs.
    if (false) {
      // @ts-expect-error toEntries (["k"] -> ["i","i..."]) then double needs ["i"], mismatch
      pipe({ a: 1 }, toEntries, double);
    }
  });

  it("compose shape-gates bare object data (no cast needed)", () => {
    if (false) {
      // @ts-expect-error toEntries expects ["k"], not ["i"] from bare array
      compose(toEntries)([1, 2, 3]);
      // @ts-expect-error double expects ["i"], not ["k"] from bare object
      compose(double)({ a: 1 });
    }
  });
});
