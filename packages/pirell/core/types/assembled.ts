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
 * threading still-open params through two generic layers cost 380K
 * insts + TS7056 (~54K once resolved here). `Omit` drops the bare
 * `Deferred` call signature, replacing it with one built from the
 * same formula as `BoundWith` — one definition of "bind T, wire Ops",
 * used at both the free-function overload and here.
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
 * What `surface.extend(ops)` returns, named once so publishers (and
 * our own packages) can annotate composed surfaces for JSR's
 * explicit-type rule instead of re-spelling the conditional.
 * `ISurface.extend` is defined as this alias — single source of
 * truth, no drift. Exported so `entry/extend.ts` can type its
 * surface-argument overload against the exact same formula.
 */
export type ExtendResult<S, Ops extends OpMap> =
  S extends Deferred<any>
    ? IsUnion<keyof Ops> extends true
      ? Assembled<
          S extends Deferred<infer Out extends Shape>
            ? ResolvedOpsDeferred<Out, Ops>
            : S
        > &
          OpMethods<Ops, S>
      : keyof Ops extends infer K extends keyof Ops
        ? Ops[K] extends
            | Op<any, infer Out extends Shape>
            | ((...args: any[]) => Op<any, infer Out extends Shape>)
          ? Assembled<
              S extends Deferred<any>
                ? ResolvedOpsDeferred<Out, Ops>
                : S extends Bound<any>
                  ? Bound<Out>
                  : never
            > &
              OpMethods<Ops, S>
          : never
        : never
    : Assembled<S> & OpMethods<Ops, S>;

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
export type Extended<Ops extends OpMap> = ExtendResult<Deferred<[]>, Ops>;

/**
 * A chained data-bound surface: `pirell(data).op(...).op(...)` — data
 * of shape `Out` with the same ops still callable. Annotate published
 * chains as `BoundWith<typeof ops, Out>`.
 */
export type BoundWith<Ops extends OpMap, Out extends Shape> = Assembled<
  Bound<Out>
> &
  OpMethods<Ops, Bound<Out>>;

/**
 * A surface's methods, as an interface so `.d.ts` emit keeps it by
 * name instead of re-expanding `extend`/`pipe`'s conditionals at every
 * surface (aliases inline in emit; interfaces are referenced by name).
 * The data type itself (`S`) stays an intersection underneath.
 */
export interface ISurface<S> {
  /**
   * Wires ops onto the surface. A single op narrows `S` to its `Out`;
   * union ops are un-narrowable, so the deferred surface is kept with
   * only ops re-wired (a fresh register call then stays deferred
   * rather than dropping the ops).
   */
  extend<Ops extends OpMap>(ops: Ops): ExtendResult<S, Ops>;
  /**
   * Threads the bound value through functions, or appends them lazily
   * on a deferred surface. Both surface kinds return a surface —
   * bound applies immediately, deferred appends.
   */
  pipe<Fns extends ChainFns<S>>(
    ...fns: Fns & Tail<Fns, CurrentData<S>>
  ): S extends Deferred<any>
    ? Assembled<S>
    : S extends Bound<any>
      ? Assembled<Bound<ShapeOf<ComposeResult<Fns>>>>
      : Assembled<S>;
  /**
   * Lazy composition — same behavior as `.pipe()` on the surface.
   */
  compose<Fns extends ChainFns<S>>(
    ...fns: Fns & Tail<Fns, CurrentData<S>>
  ): S extends Deferred<any>
    ? Assembled<S>
    : S extends Bound<any>
      ? Assembled<Bound<ShapeOf<ComposeResult<Fns>>>>
      : Assembled<S>;
}

/**
 * The decorated `pirell()` surface: methods plus data. `.extend()`
 * always accepts; shape checking fires on `Fluent`'s return (its
 * mismatch arm is uncallable), not at registration.
 */
export type Assembled<S> = ISurface<S> & S;
