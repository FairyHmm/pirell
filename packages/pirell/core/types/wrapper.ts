// The pirell wrapper's type level, one unit: per-op wiring (Fluent)
// and whole-surface assembly (Assembled) are mutually recursive, so
// they live here together. Imports point one way (leaf piles below,
// entry/ above). Dispatch is by brand first (open SpecialWire
// registry — owners contribute entries), then shape claims.

import type {
  Bound,
  CurrentShp,
  Deferred,
  Op,
  OpLike,
  OpMap,
  Shape,
} from "./base.js";
import type { ShapeOf } from "./codec.js";
import type { MatchShape } from "./match-shape.js";

/**
 * Names a shape mismatch in error output instead of an opaque `never`.
 */
export type ShapeMismatch<In extends Shape, Actual extends Shape> = {
  readonly __pirellShapeMismatch: true;
  expected: In;
  actual: Actual;
};

// Aliased Op factories can't re-match `Op<infer FIn, infer FOut>`
// (the infer pulls a shape already flattened out of DataOf), so claims
// are recovered from the op's plain data types — `unknown[]` /
// `Record<string, unknown>` are exact markers. Closed aliased claims
// stay unsupported.
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
 * Open wiring registry for special ops, keyed by brand. Intentionally
 * empty — owners add entries to the global table below by declaration
 * merging (see entry/compose.ts), so deleting an op deletes its
 * plumbing.
 */
// Registry home is a prefixed global name, not a module address:
// global interfaces merge across files AND in flat dist output, so
// entries reach downstream with no build step (module augmentation
// would dangle once bundled).
declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars -- open registry: intentionally empty; params bound by owners' entries
  interface PirellSpecialWire<S, Ops extends OpMap> {
    // no members — contributed by owners (see above).
  }
}

/** Path-exported address for the open registry (see above). */
export type SpecialWire<
  S,
  Ops extends OpMap = Record<never, never>,
> = PirellSpecialWire<S, Ops>;

/**
 * Marks an op as special: an optional phantom prop routing it to its
 * {@linkcode SpecialWire} entry. No runtime content.
 */
export type SpecialOp<K extends string, F> = F & {
  readonly __fluent?: K;
};

// Brand lookup: ordinary ops carry no brand (`unknown`) and resolve
// without touching the registry at all; only a carried brand reaches
// the lookup, so future brands stay open with no per-op cost today.
// Never infer-match the op's own signatures (their generics can't take
// the caller's S/Ops).
type BrandOf<F, S, Ops extends OpMap> = F extends {
  readonly __fluent?: infer K;
}
  ? [unknown] extends [K]
    ? never
    : K extends keyof SpecialWire<S, Ops>
      ? SpecialWire<S, Ops>[K]
      : never
  : never;

/**
 * A wired surface method: matches the op's claim against the surface's
 * proven shape, re-wiring sibling ops onto the output. The check fires
 * at the call; unfit siblings turn uncallable rather than vanishing,
 * and the failure arm sits outside the arrow so a mismatched call
 * itself is uncallable (TS2349).
 */
export type Fluent<
  F extends OpLike,
  S,
  Ops extends OpMap = Record<never, never>,
> =
  // Branded special op: wiring comes from the open registry — one arm
  // for every special op, present or future.
  BrandOf<F, S, Ops> extends never
    ? F extends (...args: infer A) => infer R
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any -- distinguishes 'factory returning a fn' from 'factory returning data'; only aliased ops arrive here and their param is set by the user, so the referent must be any
        R extends (data: any) => any
        ? // Ordinary factory: apply the args, then match its claim
          // against the surface's shape.
          FactoryPath<A, R, S, Ops>
        : DirectOpPath<F, S, Ops>
      : never
    : BrandOf<F, S, Ops>;

// One call's landing, shared by every ordinary arm: deferred rewires
// without gating; bound checks the claim, fail-closed outside the arrow.
type Land<In extends Shape, S, Call> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches any Deferred instantiation (see OpResultSurface)
  S extends Deferred<any>
    ? Call
    : MatchShape<In, CurrentShp<S>> extends true
      ? Call
      : ShapeMismatch<In, CurrentShp<S>>;

/**
 * A fixed-arity factory: apply the args, get a data fn/op, then match
 * its claim against the surface's shape.
 */
type FactoryPath<A extends unknown[], R, S, Ops extends OpMap> =
  R extends Op<infer FIn extends Shape, infer FOut extends Shape>
    ? Land<
        FIn,
        S,
        (...args: A) => Assembled<OpResultSurface<S, FOut, Ops>, Ops>
      >
    : R extends (data: infer D) => infer RD
      ? [ClaimOf<D>] extends [never]
        ? ShapeMismatch<never, CurrentShp<S>>
        : Land<
            ClaimOf<D>,
            S,
            (...args: A) => Assembled<OpResultSurface<S, OutOf<RD>, Ops>, Ops>
          >
      : never;

/** A data op as a whole function (direct Op or aliased one). */
type DirectOpPath<F, S, Ops extends OpMap> =
  F extends Op<infer In extends Shape, infer Out extends Shape>
    ? Land<In, S, () => Assembled<OpResultSurface<S, Out, Ops>, Ops>>
    : F extends (data: infer D2) => unknown
      ? [ClaimOf<D2>] extends [never]
        ? ShapeMismatch<never, CurrentShp<S>>
        : Land<ClaimOf<D2>, S, () => Assembled<OpResultSurface<S, [], Ops>, Ops>>
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
        <T>(data: T): BoundWith<O, ShapeOf<T>>;
        readonly value: undefined;
      }
    : never
  : never;

/** The surface an op application lands on: a deferred surface stays deferred (no data to gate yet — its calls bind `T` and validate claims at bind time), a bound one collapses to the result. */
export type OpResultSurface<S, Out extends Shape, Ops extends OpMap> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches any Deferred instantiation; Deferred<Shape> misses narrower outputs (covariant Bound return)
  S extends Deferred<any> ? ResolvedOpsDeferred<Out, Ops> : Bound<Out>;

/** A data-bound surface with the same ops still callable. Annotate chains as `BoundWith<typeof ops, Out>`. */
export type BoundWith<Ops extends OpMap, Out extends Shape> = Assembled<
  Bound<Out>,
  Ops
>;

/** The decorated surface: its ops map wired as callable methods, plus the data (shape `S`). */
export type Assembled<S, Ops extends OpMap = Record<never, never>> = OpMethods<
  Ops,
  S
> &
  S;
