import { describe, it, expect } from "vitest";
import { pipe } from "./pipe.js";

describe("pipe", () => {
  it("threads a value through a sequence of unary functions", () => {
    const inc = (n: number) => n + 1;
    const double = (n: number) => n * 2;
    const toString = (n: number) => `n=${n}`;

    const run = pipe(inc, double, toString);

    expect(run(1)).toBe("n=4"); // (1+1)*2
  });

  it("returns a plain function, not a bound chain", () => {
    const run = pipe((n: number) => n + 1);
    expect(typeof run).toBe("function");
    expect(run(5)).toBe(6);
  });

  it("supports arbitrary chain length", () => {
    const run = pipe(
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
    pipe(toString, inc);
  });
});
