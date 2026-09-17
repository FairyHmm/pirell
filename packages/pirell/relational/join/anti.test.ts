import { describe, expect, it } from "vitest";
import { join } from "./join.js";
import { pirell } from "../index.js";

// Domain data, bare — same fixtures as join.test.ts. Key tuples route
// the hash path; the function form routes the scan path.
const orders = [
  { order_id: 1, customer_id: 10, amount: 5 },
  { order_id: 2, customer_id: 20, amount: 7 },
  { order_id: 3, customer_id: 10, amount: 2 },
];
const customers = [
  { id: 10, name: "Ada" },
  { id: 20, name: "Bob" },
];
const on = { on: ["customer_id", "id"] } as const;

describe("anti join", () => {
  const withOrphan = [...orders, { order_id: 4, customer_id: 99, amount: 1 }];

  it("keeps unmatched left rows, unmerged and unduplicated", () => {
    expect(join(customers, { ...on, join: "anti" })(withOrphan)).toEqual([
      { order_id: 4, customer_id: 99, amount: 1 },
    ]);
  });

  it("yields empty when every left row matches", () => {
    expect(join(customers, { ...on, join: "anti" })(orders)).toEqual([]);
  });

  it("routes pair predicates through the scan path", () => {
    const result = join(customers, {
      join: "anti",
      on: (
        l: (typeof withOrphan)[number],
        r: (typeof customers)[number],
      ): [number, number] => [l.customer_id, r.id],
    })(withOrphan);
    expect(result).toEqual([{ order_id: 4, customer_id: 99, amount: 1 }]);
  });

  it("keeps every left row against an empty right", () => {
    expect(join([], { ...on, join: "anti" })(orders)).toEqual(orders);
  });

  it("yields empty against an empty left", () => {
    expect(join(customers, { ...on, join: "anti" })([])).toEqual([]);
  });

  it("works in db mode, replacing the left table", () => {
    const db = { orders: withOrphan, customers };
    const result = pirell(db).joinDb("orders", "customers", {
      ...on,
      join: "anti",
    });
    expect(result.value["orders"]).toEqual([
      { order_id: 4, customer_id: 99, amount: 1 },
    ]);
    expect(result.value["customers"]).toEqual(customers);
  });
});
