import { describe, it, expect } from "vitest";
import { compose, pipe } from "./compose.js";

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
