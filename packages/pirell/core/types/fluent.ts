// Fluent<F,S,Ops>: a wired method. Check fires at the call; Ops re-wire
// onto Bound<Out> (unfit siblings uncallable, not vanished); failure arm
// sits outside the arrow so the call itself is uncallable (TS2349).

import type { Bound, Op, OpLike, Shape } from "./base.js";
import type { MatchShape } from "./match-shape.js";
import type { Assembled, CurrentShp, OpMap } from "./assembled.js";
import type { each } from "../entry/each.js";

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
// out of DataOf, which has already flattened the tuple, so an open claim
// degrades to a putty union. DataOf is cleanly recoverable from the op's
// plain parameter though, and the open-column data types are exact
// markers — unknown[] is an indexed column, a record a keyed one. Closed
// aliased claims stay unsupported (ShapeMismatch), write those directly.
type ClaimOf<D extends unknown> = D extends unknown[]
  ? ["i", "..."]
  : D extends Record<string, unknown>
    ? ["k", "..."]
    : never;

// `Raw<[]>` resolves to unknown, so a terminal is `unknown` — its exact
// data marker. Everything else reopens the result column for the next
// bound surface.
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
  // Signature split from its Op result first: producting a function's
  // (args) => Op<...> in one pattern can't see an Op behind a return
  // alias, so factories alone would type as never. Match the signature,
  // then check the result is an Op; data ops fall to the op arm below.
  F extends (...args: infer A) => infer R
    ? R extends Op<infer FIn extends Shape, infer FOut extends Shape>
      ? MatchShape<FIn, CurrentShp<S>> extends true
        ? (...args: A) => Assembled<Bound<FOut>> & OpMethods<Ops, Bound<FOut>>
        : ShapeMismatch<FIn, CurrentShp<S>>
      : R extends (data: infer D) => infer RD
        ? [ClaimOf<D>] extends [never]
          ? ShapeMismatch<never, CurrentShp<S>>
          : MatchShape<ClaimOf<D>, CurrentShp<S>> extends true
            ? (
                ...args: A
              ) => Assembled<Bound<OutOf<RD>>> &
                OpMethods<Ops, Bound<OutOf<RD>>>
            : ShapeMismatch<ClaimOf<D>, CurrentShp<S>>
        : F extends Op<infer In extends Shape, infer Out extends Shape>
          ? MatchShape<In, CurrentShp<S>> extends true
            ? () => Assembled<Bound<Out>> & OpMethods<Ops, Bound<Out>>
            : ShapeMismatch<In, CurrentShp<S>>
          : F extends (data: infer D2) => any
            ? [ClaimOf<D2>] extends [never]
              ? ShapeMismatch<never, CurrentShp<S>>
              : MatchShape<ClaimOf<D2>, CurrentShp<S>> extends true
                ? () => Assembled<Bound<OutOf<unknown>>> &
                    OpMethods<Ops, Bound<OutOf<unknown>>>
                : ShapeMismatch<ClaimOf<D2>, CurrentShp<S>>
            : never
    : never;

// One shared definition instead of six inline copies at the surface
// return sites — each copy was an independently solved instantiation.
// Interfaces can't extend a mapped type (TS2312), so this stays an alias.
/**
 * A surface's ops as callable methods, each wired by {@linkcode Fluent}.
 * `each` is baked in as a universal member — it's a core method, not a
 * package op — so every surface advertises it and re-wires it through
 * chains, gated to keyed `S` by `Fluent` just like any other op (a
 * non-keyed surface reads it as the uncallable {@linkcode ShapeMismatch}).
 */
export type OpMethods<Ops extends OpMap, S> = {
  [P in keyof Ops]: Fluent<Ops[P], S, Ops>;
} & {
  each: Fluent<typeof each, S, Ops>;
};
