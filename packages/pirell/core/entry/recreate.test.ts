import { describe, it, expect, expectTypeOf } from "vitest";
// Import ONLY from the public entry — the point is that a user can
// recreate the library (define their own composable ops and assemble a
// surface) using nothing but the exported API.
import type { Op, BoundWith, CoreOps, Extended, ShapeOf } from "../index.js";
import { extend, pirell, compose } from "../index.js";

// Bodies are factories returning data fns; rowsOf narrows the raw JSON
// to the caller's row shape (the reusable part of custom op bodies).
const rowsOf = (data: unknown): Record<string, unknown>[] =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- custom-op bodies reify caller JSON; the record-row claim is the op's private contract
  data as Record<string, unknown>[];

// groupBy partitions keyed rows.
const groupBy =
  (key: string): Op<["i", "k", "..."], ["k", "i", "k", "..."]> =>
  (data: unknown) => {
    const rows = rowsOf(data);
    const groups: Record<string, Record<string, unknown>[]> = {};
    for (const row of rows) {
      const k = String(row[key]);
      const bucket = (groups[k] ||= []);
      bucket.push(row);
    }
    return groups;
  };

// A second user op sharing the same registration path.
const sum =
  (key: string): Op<["i", "k", "..."], []> =>
  (data: unknown) => {
    const rows = rowsOf(data);
    return rows.reduce((acc, row) => acc + Number(row[key]), 0);
  };

describe("recreating the library through the public API", () => {
  it("a parameterized op is a factory — apply args, then data", () => {
    const ORDERS = [{ status: "paid" }, { status: "open" }, { status: "paid" }];
    expect(groupBy("status")(ORDERS)).toEqual({
      paid: [{ status: "paid" }, { status: "paid" }],
      open: [{ status: "open" }],
    });
  });

  it("user ops register via extend() exactly like a built-in", () => {
    const surface = pirell().extend({ groupBy, sum });

    const paid = surface([{ status: "paid" }, { status: "open" }]).groupBy(
      "status",
    ).value;
    expect(paid).toEqual({
      paid: [{ status: "paid" }],
      open: [{ status: "open" }],
    });

    const total = surface([{ amount: 1 }, { amount: 2 }]).sum("amount").value;
    expect(total).toBe(3);
  });

  it("standalone extend(ops)(surface) works on a data-bound surface", () => {
    const result = extend({ sum })(pirell([{ amount: 4 }, { amount: 6 }])).sum(
      "amount",
    ).value;
    expect(result).toBe(10);
  });

  it("extends are chainable across successive results", () => {
    const total = pirell([{ amount: 1 }, { amount: 2 }, { amount: 3 }])
      .extend({ sum })
      .sum("amount").value;
    expect(total).toBe(6);
  });

  it("a data-less build assembled purely from user ops, then bound to data", () => {
    const chain = pirell().extend({ groupBy, sum }).groupBy("status");
    const result = chain([{ status: "a" }, { status: "b" }, { status: "a" }]);
    expect(result.value).toEqual({
      a: [{ status: "a" }, { status: "a" }],
      b: [{ status: "b" }],
    });
  });
});

describe("recreating pirell() itself through the public API", () => {
  // No builders, no brands: seed pirell(), extend with a user table over
  // CoreOps (the @pirell/ops contract). pipe/compose ride the generic arm.
  const myOps = { pipe: compose, compose };
  const myPirell: Extended<CoreOps & typeof myOps> = pirell().extend(myOps);

  it("binds data and threads it through pipe, same as pirell()", () => {
    const result = myPirell([1, 2, 3]).pipe((ns: number[]) =>
      ns.map((n) => n * 2),
    );
    expect(result.value).toEqual([2, 4, 6]);
    expectTypeOf(result.value).not.toBeAny();
  });

  it("compose threads from bound and deferred surfaces", () => {
    expect(
      myPirell([1, 2, 3]).compose((ns: number[]) => ns.map((n) => n + 1)).value,
    ).toEqual([2, 3, 4]);
    expect(myPirell.compose((ns: number[]) => ns)([9]).value).toEqual([9]);
  });

  it("grows with later .extend() calls like any surface", () => {
    const withSum = myPirell.extend({ sum });
    expect(withSum([{ amount: 1 }, { amount: 2 }]).sum("amount").value).toBe(3);
  });

  it("user tables annotate with the public composition types", () => {
    type StringCol = ShapeOf<string[]>;
    const col: BoundWith<typeof myOps, StringCol> = myPirell(["a"]);
    expectTypeOf(col.value).toEqualTypeOf<string[]>();
  });
});
