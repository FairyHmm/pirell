// Assembled<S>: the decorated pirell() surface type. Pure types —
// runtime lives in entry/assemble.ts, Fluent in types/fluent.ts
// (separate file avoids depending on its own dependent).

import type { Bound, Deferred, Op, OpLike, Raw, Shape } from "./base.js";
import type { Tail } from "./chain.js";
import type { IsUnion, ShapeOf } from "./codec.js";
import type { OpMethods } from "./fluent.js";

export type OpMap = Record<string, OpLike>;

// Unwraps a surface's bound value (paired with CurrentShp below — the
// two must stay in lockstep). Deferred checked FIRST: it structurally
// satisfies Bound too, so Bound-first would misroute it.
export type CurrentData<S> =
  S extends Deferred<infer Out extends Shape>
    ? Raw<Out>
    : S extends Bound<infer Shp extends Shape>
      ? Raw<Shp>
      : never;

// The surface's current proven Shape, read fresh at each Fluent call.
export type CurrentShp<S> =
  S extends Deferred<infer Out extends Shape>
    ? Out
    : S extends Bound<infer Shp extends Shape>
      ? Shp
      : ["..."];

// Collapses Shp/Ops before the nested <T> call signature sees them:
// threading extend<Ops>'s still-open params straight through two generic
// layers cost 380K insts + TS7056 (probe, HANDOFF) — ~54K once resolved
// here. Omit drops the bare Deferred call signature, which would
// otherwise silently swallow the Ops re-wire.
type ResolvedOpsDeferred<
  Shp extends Shape,
  Ops extends OpMap,
> = Shp extends infer S extends Shape
  ? Ops extends infer O extends OpMap
    ? Omit<Deferred<S>, "value"> & {
        <T>(
          data: T,
        ): Assembled<Bound<ShapeOf<T>>> & OpMethods<O, Bound<ShapeOf<T>>>;
        readonly value: undefined;
      }
    : never
  : never;

type ChainFns<S> = [(arg: CurrentData<S>) => any, ...Array<(arg: any) => any>];

// Deferred-only compose member. An interface so .d.ts emit references it
// by name instead of re-inlining Tail's machinery at every Deferred use.
export interface IComposable<S> {
  compose<Fns extends ChainFns<S>>(
    ...fns: Fns & Tail<Fns, CurrentData<S>>
  ): Assembled<S>;
}

// A surface's methods, as an interface so .d.ts emit keeps it by name
// instead of re-expanding extend/pipe's conditionals at every surface
// (type aliases inline in emit; interfaces are referenced by name).
// The data type itself (S) stays an intersection underneath.
export interface ISurface<S> {
  // A single op narrows S to its Out; union ops are un-narrowable, so
  // the Deferred surface is kept with only Ops re-wired (fresh register
  // call then stays deferred rather than dropping the ops).
  extend<Ops extends OpMap>(
    ops: Ops,
  ): S extends Deferred<any>
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
  // Deferred checked first — otherwise a Deferred's .pipe() would
  // collapse to unknown (Bound's arm).
  pipe<Fns extends ChainFns<S>>(
    ...fns: Fns & Tail<Fns, CurrentData<S>>
  ): S extends Deferred<any>
    ? Assembled<S>
    : S extends Bound<any>
      ? unknown
      : Assembled<S>;
}

// .extend() always accepts; shape checking fires on Fluent's return
// (its mismatch arm is uncallable), not at registration. Deferred-only
// compose rides in via the IComposable conditional.
export type Assembled<S> = ISurface<S> &
  S &
  (S extends Deferred<any> ? IComposable<S> : unknown);
