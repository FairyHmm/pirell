import { describe, expect, it } from "vitest";
import { pirell } from "../index.js";
import { every, filter, find, findLast, some } from "./predicates.js";

// Domain data, bare — same fixtures as group.test.ts. Predicate
// callbacks are on `any` rows (rows contract), so they need no
// annotations; string keys don't either.

const orders = [
  { status: "paid", amount: 5 },
  { status: "paid", amount: 7 },
  { status: "unpaid", amount: 2 },
];

type Order = (typeof orders)[number];

const users: { name: string; email?: string }[] = [
  { name: "a", email: "a@x.io" },
  { name: "b" },
  { name: "c", email: "" },
];

describe("table rows: filter", () => {
  it("keeps matching rows", () => {
    const result = pirell(orders).filter((o: Order) => o.amount > 3);
    expect(result.value).toEqual([
      { status: "paid", amount: 5 },
      { status: "paid", amount: 7 },
    ]);
  });

  it("a field name keeps rows where it reads truthy", () => {
    expect(pirell(users).filter("email").value).toEqual([
      { name: "a", email: "a@x.io" },
    ]);
  });

  it("works standalone", () => {
    expect(filter("email")(users)).toEqual([{ name: "a", email: "a@x.io" }]);
  });
});

describe("table rows: find", () => {
  it("returns the first match", () => {
    expect(pirell(orders).find((o: { amount: number }) => o.amount > 3).value).toEqual({
      status: "paid",
      amount: 5,
    });
  });

  it("yields undefined when nothing matches", () => {
    expect(pirell([1, 2]).find((n) => n > 9).value).toBeUndefined();
  });

  it("a field name matches rows where it reads truthy", () => {
    expect(find("email")(users)).toEqual({ name: "a", email: "a@x.io" });
    expect(pirell(users).find("missing").value).toBeUndefined();
  });
});

describe("table rows: findLast", () => {
  it("returns the last match", () => {
    expect(pirell([1, 2, 3, 2]).findLast((n) => n === 2).value).toBe(2);
  });

  it("a field name matches the last truthy row", () => {
    const rows: { a?: number }[] = [{ a: 0 }, { a: 1 }, { a: 2 }, {}];
    expect(pirell(rows).findLast("a").value).toEqual({ a: 2 });
    expect(findLast("missing")(rows)).toBeUndefined();
  });
});

describe("table rows: some and every", () => {
  it("answer with booleans", () => {
    expect(pirell([1, 2, 3]).some((n) => n > 2).value).toBe(true);
    expect(pirell([1, 2, 3]).every((n) => n > 2).value).toBe(false);
  });

  it("a field name tests truthiness across rows", () => {
    expect(pirell(users).some("email").value).toBe(true);
    expect(pirell(users).every("email").value).toBe(false);
    expect(pirell(users).every("name").value).toBe(true);
    expect(some("email")(users)).toBe(true);
    expect(every("name")(users)).toBe(true);
  });
});
