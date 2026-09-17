import { describe, expect, it } from "vitest";
import { resolveKeyFns } from "./keys.js";
import { naturalKey } from "./inference.js";
import type { JoinKeyValues, KeyResolver, Row } from "./keys.js";

describe("resolveKeyFns", () => {
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
