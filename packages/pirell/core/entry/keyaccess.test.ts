import { describe, expect, it } from "vitest";
import { pirell } from "../index.js";
import { toEntries } from "../ops/fixture-ops.js";

// Key access on keyed-bound surfaces: any non-op prop reads the data
// field (see KeyedAccess). Keys are index-typed `unknown` — literal
// names are erased by shapes — so no casts appear here by design. When
// a data key collides with an op name, the op wins the surface, and
// `.value` stays the escape hatch back to the raw data.
describe("key access", () => {
  it("reads members by dot and bracket", () => {
    const surface = pirell({ orders: [{ order_id: 1 }] });
    expect(surface.orders).toEqual([{ order_id: 1 }]);
    expect(surface["orders"]).toEqual([{ order_id: 1 }]);
  });

  it("destructures tables by name", () => {
    const db = {
      orders: [{ order_id: 1 }],
      customers: [{ id: 1 }],
    };
    const { orders, customers } = pirell(db);
    expect(orders).toEqual([{ order_id: 1 }]);
    expect(customers).toEqual([{ id: 1 }]);
  });

  it("ops win over colliding data keys, both syntaxes", () => {
    const surface = pirell({ pipe: [1, 2, 3] });
    expect(typeof surface.pipe).toBe("function");
    expect(typeof surface["pipe"]).toBe("function");
  });

  it("colliding op still runs", () => {
    const out = pirell({ extend: [1, 2, 3] })["extend"]({ toEntries });
    expect(out.value).toEqual({ extend: [1, 2, 3] });
  });

  it("colliding data extracts through value", () => {
    const surface = pirell({ pipe: [1, 2, 3] });
    expect(surface.value).toEqual({ pipe: [1, 2, 3] });
    expect(surface.value["pipe"]).toEqual([1, 2, 3]);
  });

  it("missing and proto keys stay undefined", () => {
    const surface = pirell({ a: [1] });
    expect(surface.nope).toBeUndefined();
    expect(surface.constructor).toBeUndefined();
  });

  it("indexes into indexed surfaces", () => {
    const surface = pirell([10, 20]);
    expect(surface[0]).toBe(10);
    expect(surface[1]).toBe(20);
  });

  it("out-of-bounds and non-index props stay undefined", () => {
    const surface = pirell([10, 20]);
    expect(surface[5]).toBeUndefined();
    // @ts-expect-error -- length is not an index; stays untyped
    expect(surface.length).toBeUndefined();
  });
});
