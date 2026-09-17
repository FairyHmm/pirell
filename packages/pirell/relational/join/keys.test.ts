import { describe, expect, it } from "vitest";
import { naturalKey, resolveKeyFns } from "./keys.js";
import type { JoinKeyValues, KeyResolver, Row } from "./keys.js";

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

  it("routes keyable specs to hash, predicates to nested", () => {
    const l: Row = { sku: "a", qty: 2 };
    const r: Row = { sku: "a", price: 9 };
    // Default (natural inference), tuples, and resolvers hash.
    expect(resolveKeyFns(l, r, undefined)).not.toBeNull();
    expect(resolveKeyFns(l, r, ["sku", "sku"])).not.toBeNull();
    expect(resolveKeyFns(l, r, naturalKey)).not.toBeNull();
    // Any branded resolver hashes — never an identity check.
    const alwaysSku: KeyResolver = Object.assign(
      () => ["sku", "sku"] as const,
      {
        __keyResolver: true as const,
      },
    );
    expect(resolveKeyFns(l, r, alwaysSku)).not.toBeNull();
    // Unbranded functions stay predicates.
    expect(
      resolveKeyFns(l, r, (a: Row, b: Row): JoinKeyValues => [
        a["qty"],
        b["price"],
      ]),
    ).toBeNull();
  });
});
