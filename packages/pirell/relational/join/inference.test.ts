import { describe, expect, it } from "vitest";
import { autoKey, naturalKey } from "./inference.js";

describe("naturalKey", () => {
  it("resolves the single shared field as a tuple", () => {
    expect(naturalKey({ sku: "a", qty: 2 }, { sku: "a", price: 9 })).toEqual([
      "sku",
      "sku",
    ]);
  });

  it("picks the first shared field in left order", () => {
    expect(naturalKey({ b: 1, a: 2 }, { a: 3, c: 4 })).toEqual(["a", "a"]);
  });

  it("throws on zero or multiple shared fields", () => {
    expect(() => naturalKey({ x: 1 }, { y: 2 })).toThrow(/no shared key/);
    expect(() => naturalKey({ a: 1, b: 2 }, { a: 1, b: 2 })).toThrow(
      /ambiguous shared keys/,
    );
  });
});

describe("autoKey", () => {
  it("infers through irregular plurals", () => {
    expect(autoKey("statuses", "orders", { id: 1 }, { status_id: 1 })).toEqual([
      "id",
      "status_id",
    ]);
    expect(autoKey("people", "orders", { id: 1 }, { person_id: 1 })).toEqual([
      "id",
      "person_id",
    ]);
  });

  it("tries left-centric, then right-centric, then natural", () => {
    expect(
      autoKey(
        "customers",
        "orders",
        { id: 10 },
        { order_id: 1, customer_id: 10 },
      ),
    ).toEqual(["id", "customer_id"]);
    expect(
      autoKey(
        "orders",
        "customers",
        { order_id: 1, customer_id: 10 },
        { id: 10 },
      ),
    ).toEqual(["customer_id", "id"]);
    expect(autoKey("a", "b", { x: 1 }, { x: 2 })).toEqual(["x", "x"]);
  });
});
