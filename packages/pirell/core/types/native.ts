// Native method surfaces from the platform's boxed interfaces (`String`,
// `Number`, `BigInt`). One table pairs each primitive data type with its
// method set (keys-by-value dual); no per-op content — new builtins flow
// through, exclusions are fixed policy. Containers dispatch by shape
// (arms land later); scalars via the caller's `Bound<S, D>`.

import type { Bound, Deferred, OpMap, Shape } from "./base.js";
import type { Assembled, OpResultSurface } from "./wrapper.js";

// Inferred generic callbacks default their params to `unknown` (e.g.
// `reduce`'s unresolved `U`); the fallthrough contract is `any` rows, so
// `unknown` is loosened back to `any` wherever inference leaves it.
type IsAny<T> = 0 extends 1 & T ? true : false;
type IsUnknown<T> =
  IsAny<T> extends true ? false : unknown extends T ? true : false;
type DeepTuple<A> = A extends unknown[]
  ? { [I in keyof A]: DeepLoosen<A[I]> }
  : A;
type DeepLoosen<T> =
  IsAny<T> extends true
    ? T
    : T extends (...args: infer A) => infer R
      ? (...args: DeepTuple<A>) => R
      : IsUnknown<T> extends true
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any -- loosened unknown: the fallthrough contract types rows as any (see above)
          any
        : T;

// A scalar landing without methods.
type TerminalS<S, Ops extends OpMap> = Assembled<
  OpResultSurface<S, [], Ops>,
  Ops
>;

// Column/string landings with the caller's description riding along.
type ColumnOf<S, Ops extends OpMap, R> = Assembled<
  OpResultSurface<S, ["i", "..."], Ops, R>,
  Ops
>;
type StringOf<S, Ops extends OpMap, R> = Assembled<
  OpResultSurface<S, [], Ops, R>,
  Ops
>;

/** String's deprecated HTML wrappers: still on the prototype, never surfaced. */
type DeprecatedHtml =
  | "anchor"
  | "big"
  | "blink"
  | "bold"
  | "fixed"
  | "fontcolor"
  | "fontsize"
  | "italics"
  | "link"
  | "small"
  | "strike"
  | "sub"
  | "sup";

// `length` is served by the property arm (builders).
/** String methods, minus `length` and deprecated HTML. */
export type SafeStringKey = Exclude<
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types -- deriving from the boxed interface is the language's own convention (autoboxing); see module doc
  keyof String,
  "length" | DeprecatedHtml
>;

/**
 * Native string methods: array results rewrap as columns, string results
 * stay stringy (recursive), the rest end as terminals. `any`-row callbacks.
 */
export type StringMethods<S, Ops extends OpMap> = {
  [K in SafeStringKey]: K extends "split"
    ? (separator: string | RegExp, limit?: number) => ColumnOf<S, Ops, string[]>
    : K extends "replace" | "replaceAll"
      ? (
          searchValue: string | RegExp,
          replaceValue:
            | string
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- replacer rest args are caller-typed (match/subgroups/offset/string)
            | ((substring: string, ...args: any[]) => string),
        ) => StringOf<S, Ops, string>
      : // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types -- boxed-interface derivation (see module doc)
        String[K] extends (...args: infer A) => infer R
        ? (...args: DeepTuple<A>) => RewireScalar<R, S, Ops>
        : never;
} & {
  /** Property arm (builders): works on strings and arrays alike. */
  length: () => TerminalS<S, Ops>;
};

/** Native number methods as a surface (`toFixed` & co. stay stringy). */
export type NumberMethods<S, Ops extends OpMap> = {
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types -- boxed-interface derivation (see module doc)
  [K in keyof Number]: Number[K] extends (...args: infer A) => infer R
    ? (...args: DeepTuple<A>) => RewireScalar<R, S, Ops>
    : never;
};

/** Native bigint methods as a surface. */
export type BigIntMethods<S, Ops extends OpMap> = {
  // eslint-disable-next-line @typescript-eslint/no-wrapper-object-types -- boxed-interface derivation (see module doc)
  [K in keyof BigInt]: BigInt[K] extends (...args: infer A) => infer R
    ? (...args: DeepTuple<A>) => RewireScalar<R, S, Ops>
    : never;
};

// `boolean`/`symbol`/`undefined`/`null` have no wrapper methods by construction.
/** One entry per supported primitive. */
export interface ScalarTable<S, Ops extends OpMap> {
  string: [data: string, methods: StringMethods<S, Ops>];
  number: [data: number, methods: NumberMethods<S, Ops>];
  bigint: [data: bigint, methods: BigIntMethods<S, Ops>];
}

// Reverse lookup: entries whose data type accepts `D` (literals via their
// general type); unions match several and collapse to method-less.
type MatchedKind<D, S, Ops extends OpMap> = {
  [K in keyof ScalarTable<S, Ops>]: D extends ScalarTable<S, Ops>[K][0]
    ? K
    : never;
}[keyof ScalarTable<S, Ops>];

// Optimistic on deferred, as with ordinary ops; containers resolve by shape later.
/**
 * Native arms: deferred exposes every scalar set; bound scalars resolve
 * from the caller's `D`.
 */
export type NativeArms<S, Ops extends OpMap> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches any Deferred instantiation (see OpResultSurface)
  S extends Deferred<any>
    ? StringMethods<S, Ops> & NumberMethods<S, Ops> & BigIntMethods<S, Ops>
    : S extends Bound<Shape, infer D>
      ? [MatchedKind<D, S, Ops>] extends [never]
        ? unknown
        : ScalarTable<S, Ops>[MatchedKind<D, S, Ops>][1]
      : unknown;

// Shared rewire: bare-`any` returns end; arrays rewrap as columns (`R`
// rides along); strings stay stringy; the rest end as plain terminals.
type RewireScalar<R, S, Ops extends OpMap> =
  IsAny<R> extends true
    ? TerminalS<S, Ops>
    : [R] extends [unknown[]]
      ? ColumnOf<S, Ops, R>
      : [R] extends [string]
        ? StringOf<S, Ops, R>
        : TerminalS<S, Ops>;
