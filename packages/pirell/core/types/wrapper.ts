// Surface types, one capability ladder mirrored by the trap: table ops
// (grown via extend), natives (derived from data kind), reads
// (keys/indices). Two structural arms cover surface operators without
// naming any: Registration results grow the table, threading-shaped
// factories thread like compose. Per-op wiring (Fluent) and assembly
// (Assembled) recurse together — one unit.

import type {
  Bound,
  CurrentData,
  CurrentShp,
  Deferred,
  Op,
  OpLike,
  OpMap,
  Raw,
  REGISTER,
  Shape,
} from "./base.js";
import type { DataOf, ShapeOf } from "./codec.js";
import type { Tail, ThreadResult } from "./stages.js";
import type { MatchShape } from "./match-shape.js";
import type { NativeArms } from "./native.js";

/**
 * Names a shape mismatch in error output instead of an opaque `never`.
 */
export type ShapeMismatch<In extends Shape, Actual extends Shape> = {
  readonly __pirellShapeMismatch: true;
  expected: In;
  actual: Actual;
};

// Aliased factories can't re-match `Op<infer>` (infer flattens out of
// DataOf), so claims recover from plain data types. Closed aliased
// claims stay unsupported.
type ClaimOf<D> = D extends unknown[]
  ? ["i", "..."]
  : D extends Record<string, unknown>
    ? ["k", "..."]
    : never;

// `unknown` marks a terminal raw result; everything else reopens its column.
type OutOf<RD> = [unknown] extends [RD]
  ? []
  : RD extends unknown[]
    ? ["i", "..."]
    : RD extends Record<string, unknown>
      ? ["k", "..."]
      : never;

/**
 * A wired surface method: the op's claim checked against the surface
 * shape, siblings re-wired onto the output. Mismatches are uncallable (TS2349).
 */
export type Fluent<
  F extends OpLike,
  S,
  Ops extends OpMap = Record<never, never>,
> = F extends (...args: infer A) => infer R
  ? // eslint-disable-next-line @typescript-eslint/no-explicit-any -- distinguishes 'factory returning a fn' from 'factory returning data'; only aliased ops arrive here and their param is set by the user, so the referent must be any
    R extends (data: any) => any
    ? // Ordinary factory: apply the args, then match its claim
      // against the surface's shape.
      FactoryPath<A, R, S, Ops>
    : DirectOpPath<F, S, Ops>
  : never;

// One call's landing: deferred rewires ungated; bound checks the claim,
// fail-closed outside the arrow.
type Land<In extends Shape, S, Call> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches any Deferred instantiation (see OpResultSurface)
  S extends Deferred<any>
    ? Call
    : MatchShape<In, CurrentShp<S>> extends true
      ? Call
      : ShapeMismatch<In, CurrentShp<S>>;

/**
 * A fixed-arity factory: Registration results grow the table; threading
 * shapes thread; everything else matches its claim against the surface.
 */
type FactoryPath<A extends unknown[], R, S, Ops extends OpMap> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches any factory return to read RD; unknown's param would reject concrete stages by contravariance
  R extends (data: any) => infer RD
    ? RD extends { readonly [REGISTER]: true; ops: OpMap }
      ? <O2 extends OpMap>(
          ...args: GrowArgs<A, O2>
        ) => GrownSurface<S, O2 & Ops>
      : Threadable<A, R> extends true
        ? ThreadPath<A, S, Ops>
        : ClaimPath<A, R, S, Ops>
    : never;

// Table-grower args: the ops map binds at the call (like the old generic
// wiring — reading it off the result would widen to OpMap); the rest
// keeps the factory's own params.
type GrowArgs<A extends unknown[], O2 extends OpMap> = A extends [
  unknown,
  ...infer Rest,
]
  ? [ops: O2, ...rest: Rest]
  : [ops: O2];

// Threading-shaped: every arg a function, stage takes unknown data.
// Covers compose/pipe and user-defined threaders alike. The `unknown[]`
// arm is real: generic factories infer their params unresolved.
type Threadable<A, R> = R extends (data: infer D) => unknown
  ? [unknown] extends [D]
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any -- stage args are caller functions; unknown would reject typed params by contravariance
      A extends Array<(arg: any) => unknown>
      ? true
      : unknown[] extends A
        ? true
        : false
    : false
  : false;

// Generic threading: deferred appends; bound checks the first fn against
// current data and re-wires siblings onto the composed result. `Fns`
// binds at the call (like the old per-op wiring) — `A` only gates entry.
type ThreadPath<A extends unknown[], S, Ops extends OpMap> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches any Deferred instantiation
  S extends Deferred<any>
    ? <Fns extends A>(...args: Fns) => Assembled<S, Ops>
    : S extends Bound<Shape, unknown>
      ? <Fns extends A>(
          ...args: Fns & Tail<Fns, CurrentData<S>>
        ) => Assembled<
          Bound<ShapeOf<ThreadResult<Fns>>, ThreadResult<Fns>>,
          Ops
        >
      : never;

type ClaimPath<A extends unknown[], R, S, Ops extends OpMap> =
  R extends Op<infer FIn extends Shape, infer FOut extends Shape>
    ? Land<
        FIn,
        S,
        (...args: A) => Assembled<OpResultSurface<S, FOut, Ops, Raw<FOut>>, Ops>
      >
    : R extends (data: infer D) => infer RD
      ? [ClaimOf<D>] extends [never]
        ? ShapeMismatch<never, CurrentShp<S>>
        : Land<
            ClaimOf<D>,
            S,
            (
              ...args: A
            ) => Assembled<OpResultSurface<S, OutOf<RD>, Ops, RD>, Ops>
          >
      : never;

/** A data op as a whole function (direct Op or aliased one). */
type DirectOpPath<F, S, Ops extends OpMap> =
  F extends Op<infer In extends Shape, infer Out extends Shape>
    ? Land<In, S, () => Assembled<OpResultSurface<S, Out, Ops, Raw<Out>>, Ops>>
    : F extends (data: infer D2) => infer RD2
      ? RD2 extends { readonly [REGISTER]: true; ops: OpMap }
        ? <O2 extends OpMap>(ops: O2) => GrownSurface<S, O2 & Ops>
        : [ClaimOf<D2>] extends [never]
          ? ShapeMismatch<never, CurrentShp<S>>
          : Land<
              ClaimOf<D2>,
              S,
              () => Assembled<OpResultSurface<S, [], Ops>, Ops>
            >
      : never;

// Interfaces can't extend a mapped type (TS2312), so this stays an alias.
/**
 * A surface's ops as callable methods, each wired by {@linkcode Fluent}.
 */
export type OpMethods<Ops extends OpMap, S> = {
  [P in keyof Ops]: Fluent<Ops[P], S, Ops>;
};

/** A deferred surface with an ops-aware call signature: binds `T`, wires `Ops` (same formula as the free {@linkcode extend} overload). */
export type ResolvedOpsDeferred<
  Shp extends Shape,
  Ops extends OpMap,
> = Shp extends infer S extends Shape
  ? Ops extends infer O extends OpMap
    ? Omit<Deferred<S>, "value"> & {
        <T>(data: T): BoundWith<O, ShapeOf<Refeed<T>>, Refeed<T>>;
        readonly value: undefined;
      }
    : never
  : never;

// Re-feed: bound unwraps to data (runtime `valueOf`); deferred passes
// through (no data yet); plain data is itself.
type Refeed<T> =
  T extends Deferred<Shape>
    ? T
    : [CurrentData<T>] extends [never]
      ? T
      : CurrentData<T>;

/** The surface an op application lands on: a deferred surface stays deferred (no data to gate yet — its calls bind `T` and validate claims at bind time), a bound one collapses to the result. */
export type OpResultSurface<
  S,
  Out extends Shape,
  Ops extends OpMap,
  D = unknown,
> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches any Deferred instantiation; Deferred<Shape> misses narrower outputs (covariant Bound return)
  S extends Deferred<any> ? ResolvedOpsDeferred<Out, Ops> : Bound<Out, D>;

/** A data-bound surface with the same ops still callable. Annotate chains as `BoundWith<typeof ops, Out>`. */
export type BoundWith<
  Ops extends OpMap,
  Out extends Shape,
  D = unknown,
> = Assembled<Bound<Out, D>, Ops>;

/** Table-grow landing: deferred rebuilds (signatures capture the table); bound keeps itself via `& S`. */
export type GrownSurface<S, Ops extends OpMap> =
  S extends Deferred<infer Out extends Shape>
    ? Assembled<ResolvedOpsDeferred<Out, Ops>, Ops> & {
        (): GrownSurface<S, Ops>;
      }
    : Assembled<S, Ops>;

/** The decorated surface: its ops map wired as callable methods, plus the data (shape `S`). */
export type Assembled<S, Ops extends OpMap = Record<never, never>> = OpMethods<
  Ops,
  S
> &
  S &
  KeyedAccess<S> &
  IndexedAccess<S> &
  NativeArms<S, Ops>;

// Untyped key access for keyed-bound surfaces (`.orders`, destructuring).
// `Record<string, unknown>` is transparent to members (`F & unknown =
// F`); literal keys are erased, so typos read `unknown` and resolve to
// `undefined` — never silently callable.
type KeyedAccess<S> =
  S extends Deferred<Shape>
    ? unknown
    : S extends Bound<infer Shp>
      ? DataOf<Shp> extends Record<string, unknown>
        ? DataOf<Shp> extends unknown[]
          ? unknown
          : Record<string, unknown>
        : unknown
      : unknown;

// Indexed access mirrors KeyedAccess for array positions (`surface[0]`).
// Numeric index signatures never collide with string-named methods.
type IndexedAccess<S> =
  S extends Deferred<Shape>
    ? unknown
    : S extends Bound<infer Shp>
      ? DataOf<Shp> extends unknown[]
        ? Record<number, unknown>
        : unknown
      : unknown;
