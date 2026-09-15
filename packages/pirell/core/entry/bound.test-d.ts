// Compile-time-only pins for bound surfaces (see bound.test.ts). This file
// is statically checked but never executed — `@ts-expect-error` IS the
// assertion: the line must fail to type-check or the directive breaks.
import { pirell } from "../index.js";
import { toEntries, entriesToObject } from "../ops/fixture-ops.js";

// .extend() accepts a mismatched op without complaint — must type-check clean.
// Exported (not imported anywhere): the binding has to count as used for
// both unused-vars rules, and a `void` or type-only use trips the other one.
export const _wiredMismatch = pirell([1, 2, 3]).extend({ toEntries });

// Calling the mismatched method is what fails to type-check.
{
  // @ts-expect-error -- toEntries expects ["k"], pirell([1,2,3]) is ["i"]
  pirell([1, 2, 3]).extend({ toEntries }).toEntries();
}

// Regression guard: the mismatch check must fire on the call itself
// (TS2349), not via the return type — a bare unused binding never
// constrains a return type, so return-position checks stay silent here.
// @ts-expect-error -- toEntries expects ["k"], pirell([1,2,3]) is ["i"]
export const _resultMismatch: unknown = pirell([1, 2, 3]).extend({ toEntries }).toEntries();

// Wrong-order calls on a multi-op extension fail to type-check too.
{
  const data = [
    ["a", 1],
    ["b", 2],
  ];
  const twoOp = pirell(data).extend({ entriesToObject, toEntries });
  // @ts-expect-error -- toEntries wants ["k"]; twoOp's shape is still ["i","i..."]
  twoOp.toEntries();
}
