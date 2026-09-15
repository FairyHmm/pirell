import { describe, it, expect, expectTypeOf } from "vitest";
// Import ONLY from the public entry — the point is that a user can
// recreate the library (define their own composable ops and assemble a
// surface) using nothing but the exported API.
import type { Op, BoundWith, Extended, OpMap, ShapeOf } from "../index.js";
import {
  extend,
  pirell,
  buildBound,
  buildDeferred,
  compose,
  each,
} from "../index.js";

// Bodies are factories returning data fns; the as-cast supplies the
// Op<...> shapes on the product.
// groupBy partitions keyed rows.
const groupBy = ((key: string) => (data: unknown) => {
  const rows = data as Record<string, unknown>[];
  const groups: Record<string, Record<string, unknown>[]> = Object.create(null);
  for (const row of rows) {
    const k = String(row[key]);
    (groups[k] ||= []).push(row);
  }
  return groups;
}) as unknown as (key: string) => Op<["i", "k", "..."], ["k", "i", "k", "..."]>;

// A second user op sharing the same registration path.
const sum = ((key: string) => (data: unknown) => {
  const rows = data as Record<string, unknown>[];
  return rows.reduce((acc, row) => acc + Number(row[key]), 0);
}) as unknown as (key: string) => Op<["i", "k", "..."], []>;

describe("recreating the library through the public API", () => {
  it("a parameterized op is a factory — apply args, then data", () => {
    const ORDERS = [{ status: "paid" }, { status: "open" }, { status: "paid" }];
    expect(groupBy("status")(ORDERS)).toEqual({
      paid: [{ status: "paid" }, { status: "paid" }],
      open: [{ status: "open" }],
    });
  });

  it("user ops register via extend() exactly like a built-in", () => {
    const surface = (pirell() as any).extend({ groupBy, sum });

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
    const result = (
      extend({ sum })(pirell([{ amount: 4 }, { amount: 6 }])) as any
    ).sum("amount").value;
    expect(result).toBe(10);
  });

  it("extends are chainable across successive results", () => {
    const total = (pirell([{ amount: 1 }, { amount: 2 }, { amount: 3 }]) as any)
      .extend({ sum })
      .sum("amount").value;
    expect(total).toBe(6);
  });

  it("a data-less build assembled purely from user ops, then bound to data", () => {
    const chain = (pirell() as any).extend({ groupBy, sum }).groupBy("status");
    const result = chain([{ status: "a" }, { status: "b" }, { status: "a" }]);
    expect(result.value).toEqual({
      a: [{ status: "a" }, { status: "a" }],
      b: [{ status: "b" }],
    });
  });
});

describe("recreating pirell() itself from buildBound/buildDeferred", () => {
  // pipe/compose are ordinary variadic ops here — Fluent's structural
  // IsVariadic check makes `.pipe` a chain method with no brand needed,
  // exactly as core's own ops map does it.
  const myOps = { pipe: compose, compose, each };

  function myPirell<T>(data: T): BoundWith<typeof myOps, ShapeOf<T>>;
  function myPirell(): Extended<typeof myOps>;
  function myPirell(...args: [unknown] | []): unknown {
    return args.length === 0
      ? buildDeferred([], myOps)
      : buildBound(args[0], myOps);
  }

  it("binds data and threads it through pipe, same as pirell()", () => {
    const result = myPirell([1, 2, 3]).pipe((ns: number[]) =>
      ns.map((n) => n * 2),
    );
    expect(result.value).toEqual([2, 4, 6]);
    expectTypeOf(result.value).not.toBeAny();
  });

  it("a custom ops map is wired the same way core's is", () => {
    const withSum = { ...myOps, sum };
    function myPirellPlus<T>(data: T): BoundWith<typeof withSum, ShapeOf<T>>;
    function myPirellPlus(): Extended<typeof withSum>;
    function myPirellPlus(...args: [unknown] | []): unknown {
      return args.length === 0
        ? buildDeferred([], withSum)
        : buildBound(args[0], withSum);
    }
    const total = myPirellPlus([{ amount: 1 }, { amount: 2 }]).sum("amount");
    expect(total.value).toBe(3);
  });
});
