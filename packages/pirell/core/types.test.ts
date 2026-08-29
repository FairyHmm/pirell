import { describe, expectTypeOf, it } from "vitest";
import type { MatchesIn, Op, Pirell, Shape } from "./types.js";

// Two keyed-mixed shapes with distinct field types, used to test both
// named-field acceptance and field-type rejection below.
type UserShape = ["k...", { name: string; age: number }];
type OrderShape = ["k...", { id: number; total: number }];

const processUsers: Op<[UserShape], ["k..."]> = (data) => ({
  value: data.value,
});

// depth-0: "i" — untyped uniform array
const sumNumbers: Op<["i"], []> = (data) => ({
  value: (data.value as number[]).reduce((a, b) => a + b, 0),
});

// depth-0: anonymous keyed (mixed, variants unspecified)
const anyKeyed: Op<["k..."], ["k..."]> = (data) => ({ value: data.value });

// depth-1: ["i", UserShape] — array of user-keyed objects
const processUserTable: Op<["i", UserShape], ["i..."]> = (data) => ({
  value: data.value,
});

// depth-2: ["i", UserShape, "i"] — array of user-keyed arrays
const processUserRows: Op<["i", UserShape, "i"], ["i..."]> = (data) => ({
  value: data.value,
});

// "i..." and "k..." — the untyped mixed shorthand
const acceptMixedI: Op<["i..."], ["i..."]> = (data) => ({
  value: data.value,
});

const acceptMixedK: Op<["k..."], ["k..."]> = (data) => ({
  value: data.value,
});

// deep chain, shape preserved: ["i", "k", ...] -> ["i", "k", ...]
const deepChainSame: Op<["i", "k", "..."], ["i", "k", "..."]> = (data) => ({
  value: data.value,
});

// deep chain, dims reordered: ["i", "k", ...] -> ["k", "i", "k", ...]
const deepChainReorder: Op<["i", "k", "..."], ["k", "i", "k", "..."]> = (
  data,
) => ({
  value: { grouped: data.value },
});

// mixed node with known positional variants actually expanded and
// matched, not just declared: ["k...", [[], ["k", "i"]]] means a keyed
// mixed node with two known branches, a leaf and a further ["k","i"].
const acceptMixedWithVariants: Op<
  [["k...", [[], ["k", "i"]]]],
  [["k...", [[], ["k", "i"]]]]
> = (data) => ({ value: data.value });

describe("named/typed shape acceptance", () => {
  it("UserShape accepts anonymous keyed on the Out side", () => {
    const data: Pirell<[UserShape]> = {
      value: { alice: { name: "alice", age: 30 } },
    };
    expectTypeOf(processUsers(data)).toMatchTypeOf<Pirell<["k..."]>>();
  });

  it("anonymous keyed accepts anonymous keyed", () => {
    const data: Pirell<["k..."]> = { value: { a: 1 } };
    expectTypeOf(anyKeyed(data)).toMatchTypeOf<Pirell<["k..."]>>();
  });

  it("'i' accepts 'i'", () => {
    const data: Pirell<["i"]> = { value: [1, 2, 3] };
    expectTypeOf(sumNumbers(data)).toMatchTypeOf<Pirell<[]>>();
  });

  it('["i", UserShape] accepts matching depth-1 shape', () => {
    const data: Pirell<["i", UserShape]> = {
      value: [{ alice: { name: "alice", age: 30 } }],
    };
    expectTypeOf(processUserTable(data)).toMatchTypeOf<Pirell<["i..."]>>();
  });

  it('["i", UserShape, "i"] accepts matching depth-2 shape', () => {
    const data: Pirell<["i", UserShape, "i"]> = {
      value: [{ scores: [1, 2, 3] }],
    };
    expectTypeOf(processUserRows(data)).toMatchTypeOf<Pirell<["i..."]>>();
  });

  it("'i...' accepts 'i...'", () => {
    const data: Pirell<["i..."]> = { value: [[1, "two"], [3]] };
    expectTypeOf(acceptMixedI(data)).toMatchTypeOf<Pirell<["i..."]>>();
  });

  it("'k...' accepts 'k...'", () => {
    const data: Pirell<["k..."]> = { value: { name: "alice", age: 30 } };
    expectTypeOf(acceptMixedK(data)).toMatchTypeOf<Pirell<["k..."]>>();
  });

  it('deep chain ["i", "k", "..."] preserves shape through to Out', () => {
    const data: Pirell<["i", "k", "..."]> = { value: [{ a: 1 }] };
    expectTypeOf(deepChainSame(data)).toMatchTypeOf<
      Pirell<["i", "k", "..."]>
    >();
  });

  it('deep chain accepts dims reordered on Out: ["i","k",...] -> ["k","i","k",...]', () => {
    const data: Pirell<["i", "k", "..."]> = { value: [{ a: 1 }] };
    expectTypeOf(deepChainReorder(data)).toMatchTypeOf<
      Pirell<["k", "i", "k", "..."]>
    >();
  });

  it("mixed node with expanded positional variants accepts matching expanded variants", () => {
    const data: Pirell<[["k...", [[], ["k", "i"]]]]> = {
      value: { a: 1, b: { c: [1, 2] } },
    };
    expectTypeOf(acceptMixedWithVariants(data)).toMatchTypeOf<
      Pirell<[["k...", [[], ["k", "i"]]]]>
    >();
  });
});

// UserShape vs. OrderShape rejection only ever comes from the shape
// itself differing (length or field types) — In/Out are the sole
// source of truth an Op is checked against.
describe("shape rejection", () => {
  it('["i", UserShape] rejects extra trailing elements (length mismatch)', () => {
    const data: Pirell<["i", UserShape, "k"]> = {
      value: [{ alice: { name: "alice", age: 30 } }, "extra"],
    };
    // @ts-expect-error -- extra trailing "k" does not satisfy ["i", UserShape]'s exact length
    processUserTable(data);
  });

  it('["i", UserShape] rejects OrderShape at the same length (field mismatch)', () => {
    const data: Pirell<["i", OrderShape]> = {
      value: [{ o1: { id: 1, total: 99 } }],
    };
    // @ts-expect-error -- OrderShape's { id, total } does not satisfy UserShape's { name, age }, independent of length
    processUserTable(data);
  });

  it("'i...' rejects 'k...'", () => {
    const data: Pirell<["k..."]> = { value: { a: 1 } };
    // @ts-expect-error -- Keyed outer dim does not match Indexed
    acceptMixedI(data);
  });

  it("'k...' rejects 'i...'", () => {
    const data: Pirell<["i..."]> = { value: [[1, 2]] };
    // @ts-expect-error -- Indexed outer dim does not match Keyed
    acceptMixedK(data);
  });

  it("mixed node rejects a different set of expanded variants", () => {
    // ["k...", [["i"], ["k","i"]]] has different variants than
    // ["k...", [[], ["k","i"]]] — same tag, different declared branches.
    const data: Pirell<[["k...", [["i"], ["k", "i"]]]]> = {
      value: { a: [1, 2], b: { c: [1, 2] } },
    };
    // @ts-expect-error -- variants [["i"],["k","i"]] does not satisfy [[],["k","i"]]
    acceptMixedWithVariants(data);
  });
});

describe("MatchesIn", () => {
  it("resolves to Actual when shapes match", () => {
    type Result = MatchesIn<["i"], ["i"]>;
    expectTypeOf<Result>().toEqualTypeOf<["i"]>();
  });

  it("resolves to never when shapes don't match", () => {
    type Result = MatchesIn<["i"], ["k"]>;
    expectTypeOf<Result>().toEqualTypeOf<never>();
  });

  it("open tail matches regardless of what follows in Actual", () => {
    type Result = MatchesIn<["i", "..."], ["i", "k", "i"]>;
    expectTypeOf<Result>().toEqualTypeOf<["i", "k", "i"]>();
  });

  it("exact match (no tail) rejects extra elements in Actual", () => {
    type Result = MatchesIn<["i"], ["i", "k"]>;
    expectTypeOf<Result>().toEqualTypeOf<never>();
  });
});
