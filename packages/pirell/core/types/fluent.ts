// Fluent<F,S,Ops>: a wired method. Dispatch is structural, never by op
// name and never by runtime brand — two tagged families first, then
// shape claims:
//  - a call yielding a Registration (extend's op body) → generic
//    ops-map call
//  - a genuinely variadic signature (accepts an arbitrary-length arg
//    tuple, e.g. compose's `<Fns extends unknown[]>(...fns: Fns)`) →
//    chain method. Fixed-arity factories (including zero-arg ones like
//    `.flat()`) don't accept an arbitrary tuple and fall through.
// Check fires at the call; Ops re-wire onto Bound<Out> (unfit siblings
// uncallable, not vanished); the failure arm sits outside the arrow so
// the call itself is uncallable (TS2349).

import type { Bound, Op, OpLike, Shape } from "./base.js";
import type { MatchShape } from "./match-shape.js";
import type { Registration } from "../entry/surface.js";
import type {
  Assembled,
  ChainMethod,
  CurrentShp,
  ExtendResult,
  OpMap,
} from "./assembled.js";

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

// True only for signatures that genuinely accept an arbitrary-length
// arg tuple (compose's `<Fns extends unknown[]>(...fns: Fns)`), tested
// by probing whether a concrete 2-tuple unifies with the inferred arg
// tuple. Fixed-arity signatures — including zero-arg factories like
// `() => (data) => R`, whose own arg tuple is the fixed `[]`, not an
// open `unknown[]` — reject the probe tuple and resolve false.
type IsVariadic<F> = F extends (...args: infer A) => any
  ? [string, number] extends A
    ? true
    : false
  : false;

/**
 * A wired surface method: matches the op's claim against the surface's
 * proven shape, re-wiring sibling ops onto the output. The check fires
 * at the call; unfit siblings turn uncallable rather than vanishing,
 * and the failure arm sits outside the arrow so a mismatched call
 * itself is uncallable (TS2349).
 */
export type Fluent<F extends OpLike, S, Ops extends OpMap = {}> =
  // Registering op (extend): grows the existing table — merge
  // `{ ...ops, ...result.ops }`, same semantics as runtime.
  F extends (ops: infer _O extends OpMap) => (data: any) => Registration
    ? <O2 extends OpMap>(ops: O2) => ExtendResult<S, O2 & Ops>
    : IsVariadic<F> extends true
      ? ChainMethod<S, Ops>
      : F extends (...args: infer A) => infer R
        ? R extends (data: any) => any
          ? // Ordinary factory: apply the args, then match its claim
            // against the surface's shape.
            FactoryPath<A, R, S, Ops>
          : DirectOpPath<F, S, Ops>
        : never;

/**
 * A fixed-arity factory: apply the args, get a data fn/op, then match
 * its claim against the surface's shape.
 */
type FactoryPath<A extends unknown[], R, S, Ops extends OpMap> =
  R extends Op<infer FIn extends Shape, infer FOut extends Shape>
    ? MatchShape<FIn, CurrentShp<S>> extends true
      ? (...args: A) => Assembled<Bound<FOut>, Ops>
      : ShapeMismatch<FIn, CurrentShp<S>>
    : R extends (data: infer D) => infer RD
      ? [ClaimOf<D>] extends [never]
        ? ShapeMismatch<never, CurrentShp<S>>
        : MatchShape<ClaimOf<D>, CurrentShp<S>> extends true
          ? (...args: A) => Assembled<Bound<OutOf<RD>>, Ops>
          : ShapeMismatch<ClaimOf<D>, CurrentShp<S>>
      : never;

/** A data op as a whole function (direct Op or aliased one). */
type DirectOpPath<F, S, Ops extends OpMap> =
  F extends Op<infer In extends Shape, infer Out extends Shape>
    ? MatchShape<In, CurrentShp<S>> extends true
      ? () => Assembled<Bound<Out>, Ops>
      : ShapeMismatch<In, CurrentShp<S>>
    : F extends (data: infer D2) => any
      ? [ClaimOf<D2>] extends [never]
        ? ShapeMismatch<never, CurrentShp<S>>
        : MatchShape<ClaimOf<D2>, CurrentShp<S>> extends true
          ? () => Assembled<Bound<OutOf<unknown>>, Ops>
          : ShapeMismatch<ClaimOf<D2>, CurrentShp<S>>
      : never;

// Interfaces can't extend a mapped type (TS2312), so this stays an alias.
/**
 * A surface's ops as callable methods, each wired by {@linkcode Fluent}.
 */
export type OpMethods<Ops extends OpMap, S> = {
  [P in keyof Ops]: Fluent<Ops[P], S, Ops>;
};
