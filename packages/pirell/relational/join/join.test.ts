import { describe, expect, it } from "vitest";
import { pipe } from "@pirell/core";
import { join, joinDb } from "./join.js";
import { naturalKey } from "./inference.js";
import { pirell } from "../index.js";

// Domain data, bare — array-of-objects derives a Table-compatible
// shape, so fixtures need no annotations. Key functions project from
// the fixture's own row types; nothing else is named.
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

describe("join", () => {
  it("inner-joins on an explicit key tuple, right-wins", () => {
    expect(join(customers, on)(orders)).toEqual([
      { order_id: 1, customer_id: 10, amount: 5, id: 10, name: "Ada" },
      { order_id: 2, customer_id: 20, amount: 7, id: 20, name: "Bob" },
      { order_id: 3, customer_id: 10, amount: 2, id: 10, name: "Ada" },
    ]);
  });

  it("duplicates left rows on one-to-many matches", () => {
    const result = join(customers, on)(orders);
    expect(result.filter((r) => r.name === "Ada")).toHaveLength(2);
  });

  it("joins on a key function over caller row types", () => {
    const result = join(customers, {
      on: (
        l: (typeof orders)[number],
        r: (typeof customers)[number],
      ): [number, number] => [l.customer_id, r.id],
    })(orders);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      order_id: 1,
      customer_id: 10,
      amount: 5,
      id: 10,
      name: "Ada",
    });
  });

  it("infers the natural key when on is omitted", () => {
    const left = [
      { sku: "a", qty: 2 },
      { sku: "b", qty: 1 },
    ];
    const right = [
      { sku: "a", price: 9 },
      { sku: "b", price: 4 },
    ];
    expect(join(right)(left)).toEqual([
      { sku: "a", qty: 2, price: 9 },
      { sku: "b", qty: 1, price: 4 },
    ]);
  });

  it("explicit naturalKey function matches omitted on", () => {
    const left = [
      { sku: "a", qty: 2 },
      { sku: "b", qty: 1 },
    ];
    const right = [
      { sku: "a", price: 9 },
      { sku: "b", price: 4 },
    ];
    expect(join(right, { on: naturalKey })(left)).toEqual(join(right)(left));
  });

  it("explicit naturalKey result matches omitted on", () => {
    const left = [
      { sku: "a", qty: 2 },
      { sku: "b", qty: 1 },
    ];
    const right = [
      { sku: "a", price: 9 },
      { sku: "b", price: 4 },
    ];
    expect(join(right, { on: naturalKey(left[0], right[0]) })(left)).toEqual(
      join(right)(left),
    );
  });

  it("throws when no shared key exists", () => {
    expect(() => join([{ x: 1 }])([{ y: 2 }])).toThrow(/no shared key/);
  });

  it("throws when multiple shared keys exist", () => {
    expect(() => join([{ a: 1, b: 2 }])([{ a: 1, b: 2 }])).toThrow(
      /ambiguous shared keys \(a, b\)/,
    );
  });

  it("inner drops unmatched rows on both sides", () => {
    const left = [...orders, { order_id: 4, customer_id: 30, amount: 9 }];
    const right = [...customers, { id: 30, name: "Cy" }];
    // Each side's orphan has no partner: inner keeps only the 3 matches.
    expect(join(customers, on)(left)).toHaveLength(3);
    expect(join(right, on)(orders)).toHaveLength(3);
  });

  it("left keeps unmatched left rows as-is", () => {
    const orphan = { order_id: 4, customer_id: 30, amount: 9 };
    const result = join(customers, { ...on, join: "left" })([
      ...orders,
      orphan,
    ]);
    expect(result).toHaveLength(4);
    expect(result[3]).toBe(orphan);
  });

  it("right keeps unmatched right rows as-is", () => {
    const orphan = { id: 30, name: "Cy" };
    const result = join([...customers, orphan], { ...on, join: "right" })(
      orders,
    );
    expect(result).toHaveLength(4);
    expect(result[3]).toBe(orphan);
  });

  it("full keeps both sides' orphans", () => {
    const leftOrphan = { order_id: 4, customer_id: 30, amount: 9 };
    const rightOrphan = { id: 40, name: "Cy" };
    const result = join([...customers, rightOrphan], {
      ...on,
      join: "full",
    })([...orders, leftOrphan]);
    expect(result).toHaveLength(5);
    expect(result).toContain(leftOrphan);
    expect(result).toContain(rightOrphan);
  });

  it("cross pairs every row", () => {
    const result = join([{ b: "x" }, { b: "y" }], { join: "cross" })([
      { a: 1 },
      { a: 2 },
    ]);
    expect(result).toEqual([
      { a: 1, b: "x" },
      { a: 1, b: "y" },
      { a: 2, b: "x" },
      { a: 2, b: "y" },
    ]);
  });

  it("right-side fields overwrite colliding left-side fields", () => {
    expect(
      join([{ id: 1, v: "r" }], { on: ["id", "id"] })([{ id: 1, v: "l" }]),
    ).toEqual([{ id: 1, v: "r" }]);
  });

  it("empty input preserves unmatched sides", () => {
    const left: { a: number }[] = [];
    expect(join([{ a: 1 }])(left)).toEqual([]);
    const right = [{ a: 1 }];
    expect(join(right, { join: "right" })(left)).toBe(right);
    expect(join(right, { join: "full" })(left)).toBe(right);
    const data = [{ a: 1 }];
    expect(join([])(data)).toEqual([]);
    expect(join([], { join: "left" })(data)).toBe(data);
    expect(join([], { join: "full" })(data)).toBe(data);
  });

  it("composes in pipe after table data", () => {
    expect(pipe(orders, join(customers, on))).toHaveLength(3);
  });

  it("wires as a fluent method", () => {
    const result = pirell(orders).join(customers, on);
    expect(result.value).toEqual([
      { order_id: 1, customer_id: 10, amount: 5, id: 10, name: "Ada" },
      { order_id: 2, customer_id: 20, amount: 7, id: 20, name: "Bob" },
      { order_id: 3, customer_id: 10, amount: 2, id: 10, name: "Ada" },
    ]);
  });
});

// Domain db, bare — the tables derive Table-compatible shapes and the
// db itself a Db-compatible one, so fixtures need no annotations.
const db = {
  orders: [
    { order_id: 1, customer_id: 10, amount: 5 },
    { order_id: 2, customer_id: 20, amount: 7 },
    { order_id: 3, customer_id: 10, amount: 2 },
  ],
  customers: [
    { id: 10, name: "Ada" },
    { id: 20, name: "Bob" },
  ],
  products: [{ sku: "x", price: 9 }],
};

describe("joinDb", () => {
  it("auto-keys dimension-left (customers.id <-> orders.customer_id)", () => {
    const result = joinDb("customers", "orders")(db);
    expect(result["customers"]).toEqual([
      { id: 10, name: "Ada", order_id: 1, customer_id: 10, amount: 5 },
      { id: 10, name: "Ada", order_id: 3, customer_id: 10, amount: 2 },
      { id: 20, name: "Bob", order_id: 2, customer_id: 20, amount: 7 },
    ]);
  });

  it("auto-keys fact-left (orders.customer_id <-> customers.id)", () => {
    const result = joinDb("orders", "customers")(db);
    expect(result["orders"]).toEqual([
      { order_id: 1, customer_id: 10, amount: 5, id: 10, name: "Ada" },
      { order_id: 2, customer_id: 20, amount: 7, id: 20, name: "Bob" },
      { order_id: 3, customer_id: 10, amount: 2, id: 10, name: "Ada" },
    ]);
  });

  it("keeps other tables intact, by reference", () => {
    const result = joinDb("orders", "customers")(db);
    expect(result["products"]).toBe(db.products);
    expect(result["customers"]).toBe(db.customers);
  });

  it("accepts an explicit tuple", () => {
    const result = joinDb("orders", "customers", {
      on: ["customer_id", "id"],
    })(db);
    expect(result["orders"]).toHaveLength(3);
  });

  it("throws on a missing table", () => {
    expect(() => joinDb("nope", "customers")(db)).toThrow(
      /table 'nope' not found/,
    );
    expect(() => joinDb("orders", "nope")(db)).toThrow(
      /table 'nope' not found/,
    );
  });

  it("throws when no convention matches", () => {
    const odd = { a: [{ x: 1 }], b: [{ y: "s" }] };
    expect(() => joinDb("a", "b")(odd)).toThrow(/no shared key/);
  });

  it("empty tables preserve unmatched semantics under the left name", () => {
    expect(
      joinDb("orders", "customers")({ ...db, orders: [] })["orders"],
    ).toEqual([]);
    expect(
      joinDb("orders", "customers", { join: "right" })({
        ...db,
        orders: [],
      })["orders"],
    ).toEqual(db.customers);
    expect(
      joinDb("orders", "customers", { join: "left" })({
        ...db,
        customers: [],
      })["orders"],
    ).toEqual(db.orders);
  });

  it("cross pairs every row under the left name", () => {
    const result = joinDb("a", "b", { join: "cross" })({
      a: [{ x: 1 }],
      b: [{ y: "s" }, { y: "t" }],
    });
    expect(result["a"]).toEqual([
      { x: 1, y: "s" },
      { x: 1, y: "t" },
    ]);
  });

  it("chains named joins (right tables stay joinable)", () => {
    // Employees carry no `id`, so the merged rows keep the
    // department `id` and the second autoKey still resolves.
    const org = {
      departments: [{ id: 1, name: "eng" }],
      employees: [
        { department_id: 1, name: "a" },
        { department_id: 1, name: "b" },
      ],
      projects: [{ project_id: 100, department_id: 1, title: "p" }],
    };
    const chained = pirell(org)
      .joinDb("departments", "employees")
      .joinDb("departments", "projects");
    expect(chained.value["departments"]).toEqual([
      { id: 1, name: "a", department_id: 1, project_id: 100, title: "p" },
      { id: 1, name: "b", department_id: 1, project_id: 100, title: "p" },
    ]);
  });

  it("composes in pipe and wires as a fluent method", () => {
    expect(pipe(db, joinDb("orders", "customers"))["orders"]).toHaveLength(3);
    const result = pirell(db).joinDb("orders", "customers");
    expect(result.value["orders"]).toHaveLength(3);
  });
});
