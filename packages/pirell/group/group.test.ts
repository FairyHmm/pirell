import { describe, expect, it } from "vitest";
import { pipe } from "@pirell/core";
import { groupBy, indexBy } from "./groups.js";
import { pirell } from "./index.js";

// Domain data, bare — array-of-objects derives a Table-compatible
// shape, so fixtures need no annotations and no seam casts. Key
// functions project from the fixture's own row type; nothing else is
// named.
const orders = [
  { status: "paid", amount: 5 },
  { status: "paid", amount: 7 },
  { status: "unpaid", amount: 2 },
];

describe("groupBy", () => {
  it("partitions rows by a string key", () => {
    const grouped = groupBy("status")(orders);
    expect(grouped).toEqual({
      paid: [
        { status: "paid", amount: 5 },
        { status: "paid", amount: 7 },
      ],
      unpaid: [{ status: "unpaid", amount: 2 }],
    });
  });

  it("partitions rows by a key function", () => {
    const grouped = groupBy((o: (typeof orders)[number]) =>
      o.amount > 3 ? "big" : "small",
    )(orders);
    expect(Object.keys(grouped).sort()).toEqual(["big", "small"]);
    expect(grouped.big).toHaveLength(2);
    expect(grouped.small).toHaveLength(1);
  });

  it("rows missing the key land under String(missing)", () => {
    const rows = [{ status: "paid" }, { amount: 1 }];
    const grouped = groupBy("status")(rows);
    expect(grouped).toEqual({
      paid: [{ status: "paid" }],
      undefined: [{ amount: 1 }],
    });
  });

  it("empty input yields no groups", () => {
    expect(groupBy("status")([])).toEqual({});
  });

  it("group keys are own properties (no prototype hazards)", () => {
    const rows = [{ k: "__proto__", v: 1 }];
    const grouped = groupBy("k")(rows);
    expect(Object.getPrototypeOf(grouped)).toBeNull();
    // NOTE: no `{ __proto__: ... }` literal here — it would set the
    // expected object's prototype instead of asserting an own key.
    expect(Object.entries(grouped)).toEqual([
      ["__proto__", [{ k: "__proto__", v: 1 }]],
    ]);
    expect(grouped["__proto__"]).toEqual([{ k: "__proto__", v: 1 }]);
  });

  it("composes in pipe after table data", () => {
    const grouped = pipe(orders, groupBy("status"));
    expect(grouped).toEqual({
      paid: [
        { status: "paid", amount: 5 },
        { status: "paid", amount: 7 },
      ],
      unpaid: [{ status: "unpaid", amount: 2 }],
    });
  });

  it("wires as a fluent method with its key argument", () => {
    const result = pirell(orders).groupBy("status");
    expect(result.value).toEqual({
      paid: [
        { status: "paid", amount: 5 },
        { status: "paid", amount: 7 },
      ],
      unpaid: [{ status: "unpaid", amount: 2 }],
    });
  });
});

describe("indexBy", () => {
  it("indexes rows by key, last row wins", () => {
    const rows = [
      { id: "a", v: 1 },
      { id: "b", v: 2 },
      { id: "a", v: 3 },
    ];
    const indexed = indexBy("id")(rows);
    expect(indexed).toEqual({
      a: { id: "a", v: 3 },
      b: { id: "b", v: 2 },
    });
  });

  it("indexes by a key function", () => {
    const indexed = indexBy((o: (typeof orders)[number]) => String(o.amount))(
      orders,
    );
    expect(Object.keys(indexed).sort()).toEqual(["2", "5", "7"]);
    expect(indexed["5"]).toEqual({ status: "paid", amount: 5 });
  });

  it("composes in pipe and wires as a fluent method", () => {
    const rows = [
      { id: "a", v: 1 },
      { id: "b", v: 2 },
    ];
    const viaPipe = pipe(rows, indexBy("id"));
    expect(viaPipe).toEqual({
      a: { id: "a", v: 1 },
      b: { id: "b", v: 2 },
    });
    const viaFluent = pirell(rows).indexBy("id");
    expect(viaFluent.value).toEqual({
      a: { id: "a", v: 1 },
      b: { id: "b", v: 2 },
    });
  });
});

describe("grouping shape rejection", () => {
  it("rejects non-table data at the type level", () => {
    // Type check only — never runs
    if (false) {
      const nums = [1, 2, 3];
      // @ts-expect-error -- groupBy expects Table, not ["i"]
      groupBy("status")(nums);
      // @ts-expect-error -- indexBy expects Table, not ["i"]
      indexBy("id")(nums);
    }
  });
});
