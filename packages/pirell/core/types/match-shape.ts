import type {
  Branch,
  Dim,
  DimTable,
  Elem,
  MixedTag,
  Shape,
  Variants,
} from "./base.js";

// Shape-vs-Shape matching. Independent of any wiring pattern.

// Canonical form for comparison: each Elem reduces to { dim, uniform }.
// Bare-tag dims read off DimTable; payload pairs add their Branch.
type Normalize<E extends Elem> = E extends Dim
  ? { dim: E; uniform: "leaf" }
  : E extends MixedTag
    ? { dim: DimTable[E]; uniform: "mixed" }
    : E extends [infer D extends Dim, infer B extends Branch]
      ? { dim: D; uniform: B }
      : E extends [infer T extends MixedTag, infer V extends Variants]
        ? { dim: DimTable[T]; uniform: V }
        : never;

// Single-direction: Actual must extend In. Elem is closed — a new arm must
// not normalize to a subtype of an existing one. A bare InE (no payload)
// claims only dim+kind, so any same-dim+kind ActualE satisfies it; a
// declared InE requires strict structural agreement.
type MatchElem<InE extends Elem, ActualE extends Elem> = InE extends
  Dim | MixedTag
  ? Normalize<ActualE>["dim"] extends Normalize<InE>["dim"]
    ? KindOf<ActualE> extends KindOf<InE>
      ? true
      : false
    : false
  : Normalize<ActualE> extends Normalize<InE>
    ? true
    : false;

// Leaf vs mixed, independent of dim: bare "i" still rejects "i...".
type KindOf<E extends Elem> = E extends MixedTag | [MixedTag, Variants]
  ? "mixed"
  : "leaf";

// "..." isn't an Elem, so its check precedes the Head/Tail destructure.
export type MatchShape<In extends Shape, Actual extends Shape> = In extends []
  ? Actual extends []
    ? true
    : false
  : In extends ["..."]
    ? true
    : [In, Actual] extends [
          [infer InHead extends Elem, ...infer InTail extends Shape],
          [infer AHead extends Elem, ...infer ATail extends Shape],
        ]
      ? MatchElem<InHead, AHead> extends true
        ? MatchShape<InTail, ATail>
        : false
      : false;

// Narrowing gate: the Shape-side counterpart of CheckData (which narrows
// Shape×Data). Returns the matched Shape for callers that keep it.
export type CheckShape<In extends Shape, Actual extends Shape> =
  MatchShape<In, Actual> extends true ? Actual : never;
