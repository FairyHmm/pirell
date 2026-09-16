import { describe, it, expect } from "vitest";
import { compose, pipe } from "./compose.js";
import type { Raw } from "../types/base.js";
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
});

// pipe/compose also integrate directly with pirell Ops (see shape-inference.md).
// Kept here, not in bound/deferred/mixed.test.ts: those only wire surfaces together.
describe("standalone pipe/compose with pirell Ops", () => {
  it("pipe(data, fns) works directly on raw JSON", () => {
    // No cast — ShapeOf derives [["i", number]] from the number[] literal
    // directly (non-union primitive leaf), matching double/sumAll's claim.
    const result = pipe([1, 2, 3], double, sumAll);
    expect(result).toBe(12);
  });

  it("compose(fns)(data) works directly on raw JSON", () => {
    const result = compose(double, sumAll)([1, 2, 3]);
    expect(result).toBe(12);
  });

  it("pipe shape-gates a bare literal, no cast", () => {
    // No `as Raw<...>` — the Op-first overload checks the data's own
    // derived shape against the first op's In. toEntries/flattenEntries
    // don't inspect value type, so no Branch claim, no cast needed here.
    const flat = pipe({ a: 1, b: 2 }, toEntries, flattenEntries);
    expect(flat).toEqual([1, 2]);
  });

  it("compose with a prior op's raw output, seam cast to double's claim", () => {
    // compose yields (data: Raw<In>) => Raw<Out>; an object literal can't
    // assign to the Raw<["k"]> brand (excess-property check), so it is fed
    // by a prior op's raw output instead — the cast-free compose path.
    // flattenEntries' Out is ["i"] (no element-type claim); double now
    // claims [["i", number]] — bridging that seam is an explicit cast,
    // not an inferred continuation (see fixture-ops.ts).
    const entries = toEntries({ a: 1, b: 2 });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the documented cross-claim seam (see the test's header comment); raw outputs are the cast-free path, open->closed element claims are explicit
    const flat = flattenEntries(entries) as unknown as Raw<[["i", number]]>;
    const result = double(flat);
    expect(result).toEqual([2, 4]);
  });
});

describe("compose/pipe: unchecked spread-array chains fail loudly", () => {
  it("wraps a stage's runtime error with stage index and cause", () => {
    const fns: Array<typeof double> = [double];
    expect(() => pipe({ a: 1 }, ...fns)).toThrow(/stage 0 threw/);
  });

  it("preserves the original error as `cause`", () => {
    const fns: Array<typeof double> = [double];
    try {
      pipe({ a: 1 }, ...fns);
      expect.unreachable();
    } catch (err) {
      if (!(err instanceof Error)) throw err;
      expect(err).toBeInstanceOf(Error);
      expect(err.cause).toBeInstanceOf(TypeError);
    }
  });

  it("a well-typed spread-array chain still works normally", () => {
    const fns: Array<typeof double> = [double];
    const result = pipe([1, 2, 3], ...fns);
    expect(result).toEqual([2, 4, 6]);
  });
});
