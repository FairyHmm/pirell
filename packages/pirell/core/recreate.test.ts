import { describe, it, expect } from "vitest";
// Import ONLY from the public entry — the point is that a user can
// recreate the library (define their own composable ops and assemble a
// surface) using nothing but the exported API.
import { op, extend, pirell } from "./index.js";

// A user-defined, dual-form (data-first or curried) op, via public `op()`.
// groupBy partitions an indexed collection of keyed rows (['i','k',...]).
const groupBy = op<["i", "k", "..."], ["k", "i", "k", "..."], [key: string]>(
  (data: unknown, key) => {
    const rows = data as Record<string, unknown>[];
    const groups: Record<string, Record<string, unknown>[]> =
      Object.create(null);
    for (const row of rows) {
      const k = String(row[key]);
      (groups[k] ||= []).push(row);
    }
    return groups;
  },
);

// A second user op sharing the same registration path.
const sum = op<["i", "k", "..."], [], [key: string]>((data: unknown, key) => {
  const rows = data as Record<string, unknown>[];
  return rows.reduce((acc, row) => acc + Number(row[key]), 0);
});

describe("recreating the library through the public API", () => {
  it("op() exposes dual-form dispatch — curried and data-first", () => {
    const byStatus = groupBy("status");
    const ORDERS = [{ status: "paid" }, { status: "open" }, { status: "paid" }];
    expect(byStatus(ORDERS)).toEqual({
      paid: [{ status: "paid" }, { status: "paid" }],
      open: [{ status: "open" }],
    });
    // data-first form — same op, same result
    expect(groupBy(ORDERS, "status")).toEqual(byStatus(ORDERS));
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

  it("standalone extend(ops)(surface) works on a data-bound Wrapper", () => {
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
