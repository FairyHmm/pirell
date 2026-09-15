// Compile-time-only pins for standalone pipe/compose shape rejection
// (see compose.test.ts) — statically checked, never runs.
import { compose, pipe } from "./compose.js";
import { double, toEntries, flattenEntries } from "../ops/fixture-ops.js";

// @ts-expect-error toEntries expects ["k"], not the derived ["i"]
pipe([1, 2, 3], toEntries);

// @ts-expect-error double expects [["i", number]], not the derived ["k"]
pipe({ a: 1 }, double);

// A compose link whose Out can't feed the next In.
{
  // @ts-expect-error double Out [["i", number]] can't feed toEntries In ["k"]
  compose(double, toEntries);
  // @ts-expect-error double Out [["i", number]] can't feed flattenEntries In ["i","i..."]
  compose(double, flattenEntries);
  // @ts-expect-error flattenEntries Out ["i"] (no element claim) can't feed double In [["i", number]]
  compose(flattenEntries, double);
}

// @ts-expect-error toEntries (["k"] -> ["i","i..."]) then double needs [["i", number]], mismatch
pipe({ a: 1 }, toEntries, double);

// compose shape-gates bare object data (no cast needed).
{
  // @ts-expect-error toEntries expects ["k"], not ["i"] from bare array
  compose(toEntries)([1, 2, 3]);
  // @ts-expect-error double expects [["i", number]], not ["k"] from bare object
  compose(double)({ a: 1 });
}

// compose rejects a mismatched chain at the type level.
{
  const toString = (n: number) => `${n}`;
  const inc = (n: number) => n + 1;
  // @ts-expect-error -- toString's output (string) doesn't match inc's input (number)
  compose(toString, inc);
}

// pipe rejects a mismatched chain at the type level.
{
  const toString = (n: number) => `${n}`;
  const inc = (n: number) => n + 1;
  // @ts-expect-error -- toString's output (string) doesn't match inc's input (number)
  pipe(1, toString, inc);
}
