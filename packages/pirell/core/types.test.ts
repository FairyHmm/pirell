import { describe, it, expectTypeOf } from "vitest";
import { defineOp, idim, kdim } from "./types.js";
import type { Indexed, Keyed, Mixed, Pirell } from "./types.js";

type User = { name: string; age: number };
type Order = { id: number; total: number };

const UserDim = kdim<User>();
const OrderDim = kdim<Order>();
const NumRowDim = idim<number>();
const StrRowDim = idim<string>();
const MixedI: Mixed<"i"> = { __mixed: "i", __variants: [] };
const MixedK: Mixed<"k"> = { __mixed: "k", __variants: [] };

// depth-0: Keyed<User>
const processUsers = defineOp({
  in: [UserDim] as [Keyed<User>],
  out: ["k"] as const,
  run: (data: Pirell<[Keyed<User>], Record<string, User>>) => ({
    shape: ["k"] as const,
    value: data.value,
  }),
});

// depth-0: Indexed<number>
const sumNumbers = defineOp({
  in: [NumRowDim] as [Indexed<number>],
  out: [] as const,
  run: (data: Pirell<[Indexed<number>], number[]>) => ({
    shape: [] as const,
    value: data.value.reduce((a, b) => a + b, 0),
  }),
});

// depth-0: anonymous 'k'
const anyKeyed = defineOp({
  in: ["k"] as const,
  out: ["k"] as const,
  run: (data: Pirell<["k"], Record<string, unknown>>) => ({
    shape: ["k"] as const,
    value: data.value,
  }),
});

// depth-1: ['i', Keyed<User>] — array of user-keyed objects
const processUserTable = defineOp({
  in: ["i", UserDim] as ["i", Keyed<User>],
  out: ["i"] as const,
  run: (data: Pirell<["i", Keyed<User>], Record<string, User>[]>) => ({
    shape: ["i"] as const,
    value: data.value,
  }),
});

// depth-2: ['i', Keyed<User>, 'i'] — array of user-keyed arrays
const processUserRows = defineOp({
  in: ["i", UserDim, "i"] as ["i", Keyed<User>, "i"],
  out: ["i"] as const,
  run: (data: Pirell<["i", Keyed<User>, "i"], Record<string, number[]>[]>) => ({
    shape: ["i"] as const,
    value: data.value,
  }),
});

// Mixed<'i'> and Mixed<'k'>
const acceptMixedI = defineOp({
  in: [MixedI] as [Mixed<"i">],
  out: ["i"] as const,
  run: (data: Pirell<[Mixed<"i">], unknown[]>) => ({
    shape: ["i"] as const,
    value: data.value,
  }),
});

const acceptMixedK = defineOp({
  in: [MixedK] as [Mixed<"k">],
  out: ["k"] as const,
  run: (data: Pirell<[Mixed<"k">], Record<string, unknown>>) => ({
    shape: ["k"] as const,
    value: data.value,
  }),
});

describe("named dim type-level acceptance", () => {
  it("Keyed<User> accepts Keyed<User>", () => {
    const data: Pirell<[Keyed<User>], Record<string, User>> = {
      shape: [UserDim],
      value: { alice: { name: "alice", age: 30 } },
    };
    expectTypeOf(processUsers(data)).toMatchTypeOf<Pirell<["k"], Record<string, User>>>();
  });

  it("'k' accepts Keyed<User>", () => {
    const data: Pirell<[Keyed<User>], Record<string, User>> = {
      shape: [UserDim],
      value: { alice: { name: "alice", age: 30 } },
    };
    expectTypeOf(anyKeyed(data as any)).toMatchTypeOf<Pirell<["k"], Record<string, unknown>>>();
  });

  it("'k' accepts plain 'k'", () => {
    const data: Pirell<["k"], Record<string, unknown>> = { shape: ["k"], value: { a: 1 } };
    expectTypeOf(anyKeyed(data)).toMatchTypeOf<Pirell<["k"], Record<string, unknown>>>();
  });

  it("Indexed<number> accepts Indexed<number>", () => {
    const data: Pirell<[Indexed<number>], number[]> = { shape: [NumRowDim], value: [1, 2, 3] };
    expectTypeOf(sumNumbers(data)).toMatchTypeOf<Pirell<[], number>>();
  });

  it("['i', Keyed<User>] accepts matching depth-1 shape", () => {
    const data: Pirell<["i", Keyed<User>], Record<string, User>[]> = {
      shape: ["i", UserDim],
      value: [{ alice: { name: "alice", age: 30 } }],
    };
    expectTypeOf(processUserTable(data)).toMatchTypeOf<Pirell<["i"], Record<string, User>[]>>();
  });

  it("['i', Keyed<User>, 'i'] accepts matching depth-2 shape", () => {
    const data: Pirell<["i", Keyed<User>, "i"], Record<string, number[]>[]> = {
      shape: ["i", UserDim, "i"],
      value: [{ scores: [1, 2, 3] }],
    };
    expectTypeOf(processUserRows(data)).toMatchTypeOf<Pirell<["i"], Record<string, number[]>[]>>();
  });

  it("Mixed<'i'> accepts Mixed<'i'>", () => {
    const data: Pirell<[Mixed<"i">], unknown[]> = { shape: [MixedI], value: [[1, "two"], [3]] };
    expectTypeOf(acceptMixedI(data)).toMatchTypeOf<Pirell<["i"], unknown[]>>();
  });

  it("Mixed<'k'> accepts Mixed<'k'>", () => {
    const data: Pirell<[Mixed<"k">], Record<string, unknown>> = {
      shape: [MixedK],
      value: { name: "alice", age: 30 },
    };
    expectTypeOf(acceptMixedK(data)).toMatchTypeOf<Pirell<["k"], Record<string, unknown>>>();
  });
});

describe("named dim type-level rejection", () => {
  it("Keyed<User> rejects Keyed<Order>", () => {
    const data: Pirell<[Keyed<Order>], Record<string, Order>> = {
      shape: [OrderDim],
      value: { o1: { id: 1, total: 99 } },
    };
    // @ts-expect-error -- Keyed<Order> does not extend Keyed<User>
    processUsers(data);
  });

  it("Indexed<number> rejects Indexed<string>", () => {
    const data: Pirell<[Indexed<string>], string[]> = { shape: [StrRowDim], value: ["a", "b"] };
    // @ts-expect-error -- Indexed<string> does not satisfy Indexed<number>
    sumNumbers(data);
  });

  it("Keyed<User> rejects plain 'k'", () => {
    const data: Pirell<["k"], Record<string, unknown>> = { shape: ["k"], value: { x: 1 } };
    // @ts-expect-error -- anonymous 'k' does not satisfy Keyed<User>
    processUsers(data);
  });

  it("['i', Keyed<User>] rejects wrong named dim at depth 1", () => {
    const data: Pirell<["i", Keyed<Order>], Record<string, Order>[]> = {
      shape: ["i", OrderDim],
      value: [{ o1: { id: 1, total: 99 } }],
    };
    // @ts-expect-error -- Keyed<Order> at depth 1 does not satisfy Keyed<User>
    processUserTable(data);
  });

  it("['i', Keyed<User>, 'i'] rejects wrong dim at depth 1", () => {
    const data: Pirell<["i", Keyed<Order>, "i"], Record<string, number[]>[]> = {
      shape: ["i", OrderDim, "i"],
      value: [{ scores: [1, 2] }],
    };
    // @ts-expect-error -- Keyed<Order> at depth 1 does not satisfy Keyed<User>
    processUserRows(data);
  });

  it("Mixed<'i'> rejects Mixed<'k'>", () => {
    const data: Pirell<[Mixed<"k">], Record<string, unknown>> = {
      shape: [MixedK],
      value: { a: 1 },
    };
    // @ts-expect-error -- Mixed<'k'> outer dim does not match Mixed<'i'>
    acceptMixedI(data);
  });

  it("Mixed<'k'> rejects Mixed<'i'>", () => {
    const data: Pirell<[Mixed<"i">], unknown[]> = { shape: [MixedI], value: [[1, 2]] };
    // @ts-expect-error -- Mixed<'i'> outer dim does not match Mixed<'k'>
    acceptMixedK(data);
  });
});
