// Fluent<F,S,Ops>: a wired method. Check fires at the call; Ops re-wire
// onto Bound<Out> (unfit siblings uncallable, not vanished); failure arm
// sits outside the arrow so the call itself is uncallable (TS2349).
//
// Two tagged families dispatch before the fixed-arity data-op path,
// mirroring the tags builders.ts already applies at runtime — no op
// name is ever mentioned:
//  - an op whose call yields a Registration grows the surface's method
//    table, so its method is a generic ops-map call (extend). The gate
//    is the Registration result, the same marker runOp checks.
//  - an op carrying the chain brand (a marked var-args-fn op like
//    `pipe: markChain(compose)` in an ops map) threads the surface
//    through its functions and re-binds: what makeFlat turned data-first
//    at runtime. The gate is that brand, the type-level mirror of
//    markRegistering; publishers brand their own var-args-fn ops to get
//    the same chain method.

import type { Bound, Op, OpLike, Shape } from "./base.js";
import type { MatchShape } from "./match-shape.js";
import type { Registration } from "../entry/surface.js";
import type { chain } from "../entry/compose.js";
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

// Aliased Op factories (e.g. a group's `Rewrap = Op<["i","..."], ...>`)
// can't re-match `Op<infer FIn, infer FOut>`: the infer pulls the shape
// out of DataOf, already flattened, so an open claim degrades to a putty
// union. DataOf is recoverable from the op's plain parameter though, and
// the open-column data types are exact markers (unknown[] is indexed, a
// record keyed). Closed aliased claims stay unsupported — write directly.
type ClaimOf<D extends unknown> = D extends unknown[]
  ? ["i", "..."]
  : D extends Record<string, unknown>
    ? ["k", "..."]
    : never;

// `Raw<[]>` is unknown, so a terminal raw result is `unknown` — its
// exact data marker. Everything else reopens the result column.
type OutOf<RD extends unknown> = [unknown] extends [RD]
  ? []
  : RD extends unknown[]
    ? ["i", "..."]
    : RD extends Record<string, unknown>
      ? ["k", "..."]
      : never;

/**
 * A wired surface method: matches the op's claim against the surface's
 * proven shape, re-wiring sibling ops onto the output. The check fires
 * at the call; unfit siblings turn uncallable rather than vanishing,
 * and the failure arm sits outside the arrow so a mismatched call
 * itself is uncallable (TS2349).
 */
export type Fluent<F extends OpLike, S, Ops extends OpMap = {}> =
  // Registering op (extend): yields a Registration when called. The
  // method grows the existing table — merge semantics, the same
  // `{ ...ops, ...result.ops }` builders.ts applies at runtime — so
  // full-map (`pirellRaw().extend(wholeMap)` via `Extended`) and
  // chained partial extends agree with what actually runs.
  F extends (ops: infer _O extends OpMap) => (data: any) => Registration
    ? <O2 extends OpMap>(ops: O2) => ExtendResult<S, O2 & Ops>
    : F extends chain
      ? ChainMethod<S, Ops>
      : F extends (...args: infer A) => infer R
        ? R extends (data: any) => any
          ? // Ordinary factory (fixed or loose-arity — assign/push/splice/
            // reduce among groups): apply the args, get a data fn/op, then
            // match its claim against the surface's shape. Only branded
            // chains thread the surface itself.
            FactoryPath<F, A, R, S, Ops>
          : DirectOpPath<F, S, Ops>
        : never;

/**
 * A fixed-arity factory: apply the args, get a data fn/op, then match
 * its claim against the surface's shape.
 */
type FactoryPath<F, A extends unknown[], R, S, Ops extends OpMap> =
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

// One shared definition instead of six inline copies at the surface
// return sites — each copy was an independently solved instantiation.
// Interfaces can't extend a mapped type (TS2312), so this stays an alias.
/**
 * A surface's ops as callable methods, each wired by {@linkcode Fluent}.
 */
export type OpMethods<Ops extends OpMap, S> = {
  [P in keyof Ops]: Fluent<Ops[P], S, Ops>;
};
