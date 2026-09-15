// Assembled<S>: the decorated pirell() surface type. Pure types —
// runtime lives in entry/builders.ts, Fluent in types/fluent.ts.

import type { Bound, Deferred, Op, OpLike, Raw, Shape } from "./base.js";
import type { ComposeResult, Tail } from "./chain.js";
import type { IsUnion, ShapeOf } from "./codec.js";
import type { OpMethods } from "./fluent.js";

/** A method table: names to registrable ops. */
export type OpMap = Record<string, OpLike>;

/**
 * Reads a surface's bound value (paired with {@linkcode CurrentShp} —
 * the two must stay in lockstep). Deferred checked first: it
 * structurally satisfies `Bound` too, so Bound-first would misroute it.
 */
export type CurrentData<S> =
  S extends Deferred<infer Out extends Shape>
    ? Raw<Out>
    : S extends Bound<infer Shp extends Shape>
      ? Raw<Shp>
      : never;

/** The surface's current proven shape, read fresh at each `Fluent` call. */
export type CurrentShp<S> =
  S extends Deferred<infer Out extends Shape>
    ? Out
    : S extends Bound<infer Shp extends Shape>
      ? Shp
      : ["..."];

/**
 * Collapses Shp/Ops before the nested call signature sees them:
 * threading open params through two generic layers cost 380K insts +
 * TS7056 (~54K once resolved here). `Omit` drops the bare `Deferred`
 * call signature, replacing it with `BoundWith`'s formula — one
 * definition of "bind T, wire Ops" for the free-function overload and
 * here.
 */
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

/**
 * What `surface.extend(ops)` returns, named once so publishers can
 * annotate composed surfaces for JSR's explicit-type rule instead of
 * re-spelling the conditional. `Fluent` routes registering ops to
 * this alias — single source of truth. Exported so `entry/extend.ts`
 * types its surface-argument overload against the same formula.
 */
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
 * The common composition: `pirell().extend(ops)` — deferred surface,
 * ops re-wired. Annotate published compositions as
 * `Extended<typeof ops>`.
 *
 * ```ts
 * import { pirell } from "@pirell/core";
 * import type { Extended } from "@pirell/core";
 *
 * const ops = { double: () => (ns: number[]) => ns.map((n) => n * 2) };
 * const $: Extended<typeof ops> = pirell().extend(ops);
 * $([1, 2]).double().value; // [2, 4]
 * ```
 */
export type Extended<Ops extends OpMap> = ExtendResult<Deferred<[]>, Ops> & {
  (): ExtendResult<Deferred<[]>, Ops>;
};

/**
 * A chained data-bound surface: `pirell(data).op(...).op(...)` — data
 * of shape `Out` with the same ops still callable. Annotate published
 * chains as `BoundWith<typeof ops, Out>`.
 */
export type BoundWith<Ops extends OpMap, Out extends Shape> = Assembled<
  Bound<Out>,
  Ops
>;

/**
 * A chain op's surface method (`.pipe`/`.compose`: branded var-args-fn
 * ops). Bound surfaces re-bind to the composed result; deferred
 * surfaces append and stay deferred. Named once so `Fluent` can
 * reference it structurally — no op name appears anywhere (`Fluent`
 * recognizes the op by its `chain` brand, what `markChain` attaches).
 */
export type ChainMethod<S, Ops extends OpMap = {}> = {
  <Fns extends ChainFns<S>>(
    ...fns: Fns & Tail<Fns, CurrentData<S>>
  ): S extends Deferred<any>
    ? Assembled<S, Ops>
    : S extends Bound<any>
      ? Assembled<Bound<ShapeOf<ComposeResult<Fns>>>, Ops>
      : Assembled<S, Ops>;
};

/**
 * The decorated surface: its ops map wired as callable methods, plus
 * the data (shape `S`). Nothing is hardcoded — `.extend`, `.pipe`, and
 * `.compose` are ordinary map entries (`coreOps` seeds them), typed by
 * `Fluent` exactly like any package op. A surface offers precisely
 * what its ops map offered.
 */
export type Assembled<S, Ops extends OpMap = {}> = OpMethods<Ops, S> & S;
