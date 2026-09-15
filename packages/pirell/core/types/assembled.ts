// Assembled<S>: the decorated pirell() surface type. Pure types —
// runtime lives in entry/builders.ts, Fluent in types/fluent.ts.

import type { Bound, Deferred, Op, OpLike, Raw, Shape } from "./base.js";
import type { ComposeResult, Tail } from "./chain.js";
import type { IsUnion, ShapeOf } from "./codec.js";
import type { OpMethods } from "./fluent.js";

/** A method table: names to registrable ops. */
export type OpMap = Record<string, OpLike>;

/** Bound value read off the surface's shape ({@linkcode Deferred} checked first — it satisfies {@linkcode Bound} too). */
export type CurrentData<S> =
  S extends Deferred<infer Out extends Shape>
    ? Raw<Out>
    : S extends Bound<infer Shp extends Shape>
      ? Raw<Shp>
      : never;

/** The surface's proven shape, read fresh at each call. */
export type CurrentShp<S> =
  S extends Deferred<infer Out extends Shape>
    ? Out
    : S extends Bound<infer Shp extends Shape>
      ? Shp
      : ["..."];

/** A deferred surface with an ops-aware call signature: binds `T`, wires `Ops` (same formula as the free {@linkcode extend} overload). */
export type ResolvedOpsDeferred<
  Shp extends Shape,
  Ops extends OpMap,
> = Shp extends infer S extends Shape
  ? Ops extends infer O extends OpMap
    ? Omit<Deferred<S>, "value"> & {
        <T>(data: T): BoundWith<O, ShapeOf<T>>;
        readonly value: undefined;
      }
    : never
  : never;

type ChainFns<S> = [(arg: CurrentData<S>) => any, ...Array<(arg: any) => any>];

/** What `surface.extend(ops)` returns — named once for publishers. */
export type ExtendResult<S, Ops extends OpMap> =
  S extends Deferred<any>
    ? IsUnion<keyof Ops> extends true
      ? Assembled<
          S extends Deferred<infer Out extends Shape>
            ? ResolvedOpsDeferred<Out, Ops>
            : S,
          Ops
        > & { (): ExtendResult<S, Ops> }
      : keyof Ops extends infer K extends keyof Ops
        ? Ops[K] extends
            | Op<any, infer Out extends Shape>
            | ((...args: any[]) => Op<any, infer Out extends Shape>)
          ? Assembled<
              S extends Deferred<any>
                ? ResolvedOpsDeferred<Out, Ops>
                : S extends Bound<any>
                  ? Bound<Out>
                  : never,
              Ops
            > & { (): ExtendResult<S, Ops> }
          : never
        : never
    : Assembled<S, Ops>;

/**
 * The common composition: ops wired onto a deferred surface. Annotate
 * published compositions as `Extended<typeof ops>`.
 *
 * ```ts
 * import { pirell } from "@pirell/core";
 * import type { Extended, Op } from "@pirell/core";
 *
 * const ops = {
 *   double: (): Op<[["i", number]], [["i", number]]> => (ns) =>
 *     ns.map((n) => n * 2),
 * };
 * const $: Extended<typeof ops> = pirell().extend(ops);
 * $([1, 2]).double().value; // [2, 4]
 * ```
 */
export type Extended<Ops extends OpMap> = ExtendResult<Deferred<[]>, Ops> & {
  (): ExtendResult<Deferred<[]>, Ops>;
};

/** A data-bound surface with the same ops still callable. Annotate chains as `BoundWith<typeof ops, Out>`. */
export type BoundWith<Ops extends OpMap, Out extends Shape> = Assembled<
  Bound<Out>,
  Ops
>;

/** A chain op's surface method: bound surfaces re-bind to the composed result; deferred append and stay deferred. */
export type ChainMethod<S, Ops extends OpMap = {}> = {
  <Fns extends ChainFns<S>>(
    ...fns: Fns & Tail<Fns, CurrentData<S>>
  ): S extends Deferred<any>
    ? Assembled<S, Ops>
    : S extends Bound<any>
      ? Assembled<Bound<ShapeOf<ComposeResult<Fns>>>, Ops>
      : Assembled<S, Ops>;
};

/** The decorated surface: its ops map wired as callable methods, plus the data (shape `S`). */
export type Assembled<S, Ops extends OpMap = {}> = OpMethods<Ops, S> & S;
