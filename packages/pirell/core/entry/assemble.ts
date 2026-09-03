// The decorated pirell() surface: fully-assembled, method-carrying, with
// type-level shape inference. Bare Wrapper lives in pirell.ts; runtime
// builders in builders.ts.

import { buildDeferred, buildWrapper } from "./builders.js";
import type {
  Bound,
  Deferred,
  Dim,
  Fluent,
  Op,
  Raw,
  Shape,
} from "../types/types.js";
import type { MatchesIn } from "../types/match.js";
import type { Tail } from "../types/chain.js";

export type OpMap = Record<string, Op<any, any, any>>;

// What the next op sees: unwraps a surface whose Shape param is always
// already proven, so no structural inference is needed (unlike chain.ts's
// link matching — different layer, not a duplicate; see PLAN.md's
// "Unify ShapeOfCur/CurrentData").
type CurrentData<S> =
  S extends Bound<infer Shp extends Shape>
    ? Raw<Shp>
    : S extends Deferred<infer Out extends Shape>
      ? Raw<Out>
      : never;

// Proven shape of CurrentData<S>: the CurShp half of Tail's threading.
// Always in lockstep above: Raw<Shp> value, Shp shape.
type CurrentShp<S> =
  S extends Bound<infer Shp extends Shape>
    ? Shp
    : S extends Deferred<infer Out extends Shape>
      ? Out
      : ["..."];

// Retypes the surface after an op to reflect the new output shape.
type Reassembled<S, Shp extends Shape> =
  S extends Bound<any>
    ? Assembled<Bound<Shp>>
    : S extends Deferred<any>
      ? Assembled<Deferred<Shp>>
      : never;

// An op fits the surface iff its input shape matches the current data.
type Fits<In extends Shape, S, Yes> =
  MatchesIn<In, Extract<CurrentData<S>, Shape>> extends Shape ? Yes : never;

// Chain constraint, shared by pipe/compose: first fn takes current data.
type ChainFns<S> = [
  (arg: CurrentData<S>) => any,
  ...Array<(arg: any) => any>,
];

// Deferred-only compose member, split out so Assembled stays flat.
type Composable<S> = S extends Deferred<any>
  ? {
      compose<Fns extends ChainFns<S>>(
        ...fns: Fns & Tail<Fns, CurrentData<S>, CurrentShp<S>>
      ): Assembled<S>;
    }
  : unknown;

// compose() is Deferred-only: a Bound surface has no un-applied state to
// compose into, so it would just be pipe() under a name promising the
// opposite. The runtime is built once as a plain callable and cast here —
// per-call-rebuild inference is an intentional non-goal.
export type Assembled<S> = S & {
  extend<K extends string, Op1 extends Op<any, any, any>>(
    ops: Op1 extends Op<infer In, any, any>
      ? Fits<In, S, Record<K, Op1>>
      : never,
  ): Op1 extends Op<any, infer Out, any>
    ? Reassembled<S, Out> & { [P in K]: Fluent<Op1> }
    : never;
  extend<Ops extends OpMap>(
    ops: Ops & {
      [K in keyof Ops]: Ops[K] extends Op<infer In, any, any>
        ? Fits<In, S, Ops[K]>
        : never;
    },
  ): Assembled<S> & {
    [K in keyof Ops]: Fluent<Ops[K] & Op<any, any, any>>;
  };
  pipe<Fns extends ChainFns<S>>(
    ...fns: Fns & Tail<Fns, CurrentData<S>, CurrentShp<S>>
  ): S extends Bound<any> ? unknown : Assembled<S>;
} & Composable<S>;

// pirell(data) → Bound surface; pirell() → Deferred builder. Arity (not an
// explicit undefined) selects the form, so a bound undefined stays invalid.
export function pirell(data: unknown): Assembled<Bound<Dim[]>>;
export function pirell(): Assembled<Deferred<[]>>;
export function pirell(...args: [unknown] | []): unknown {
  if (args.length === 0) {
    return buildDeferred([], {});
  }
  return buildWrapper(args[0], {});
}
