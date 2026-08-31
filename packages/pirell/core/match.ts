import type {
  Branch,
  Dim,
  Elem,
  MixedTag,
  Raw,
  Shape,
  Variants,
} from "./types.js";

// Shape-matching primitive, independent of any wiring pattern. Any
// non-Op engine can check a Shape against another Shape (type-representation.md).

type DimOf<T extends MixedTag> = T extends `${infer D extends Dim}...`
  ? D
  : never;

// Canonical form for comparison: each Elem reduces to { dim, uniform }.
// "i" ≠ "i..." — different uniform.
type Normalize<E extends Elem> = E extends Dim
  ? { dim: E; uniform: "leaf" }
  : E extends MixedTag
    ? { dim: DimOf<E>; uniform: "mixed" }
    : E extends [infer D extends Dim, infer B extends Branch]
      ? { dim: D; uniform: B }
      : E extends [infer T extends MixedTag, infer V extends Variants]
        ? { dim: DimOf<T>; uniform: V }
        : never;

// Structural equality on Normalize's output (see type-representation.md).
// Bidirectional extends would silently accept a NEW Elem form that
// normalizes identically to an existing one — check before adding an arm.
type ElemMatches<InE extends Elem, ActualE extends Elem> =
  Normalize<ActualE> extends Normalize<InE>
    ? Normalize<InE> extends Normalize<ActualE>
      ? true
      : false
    : false;

// "..." → open tail succeeds; must precede Head/Tail since "..." isn't an Elem.
type MatchesShape<In extends Shape, Actual extends Shape> = In extends []
  ? Actual extends []
    ? true
    : false
  : In extends ["..."]
    ? true
    : [In, Actual] extends [
          [infer InHead extends Elem, ...infer InTail extends Shape],
          [infer AHead extends Elem, ...infer ATail extends Shape],
        ]
      ? ElemMatches<InHead, AHead> extends true
        ? MatchesShape<InTail, ATail>
        : false
      : false;

// Open tail succeeds iff "..." appears in In; otherwise exact match required.
export type MatchesIn<In extends Shape, Actual extends Shape> =
  MatchesShape<In, Actual> extends true ? Actual : never;

// --- Call-site shape inference (see shape-inference.md) ---
//
// ShapeOf<D> derives a Shape from a bare literal so calls need no `as Raw<S>` cast.

// True iff T is a genuine union (naked-T distributive trick).
type IsUnion<T, U = T> = T extends U ? ([U] extends [T] ? false : true) : never;

// Recheck against Shape is for tsc's inference at Check, not runtime. A
// genuinely-union element type is heterogeneous by construction → "i..."/"k...".
export type ShapeOf<D> = _ShapeOf<D> extends Shape ? _ShapeOf<D> : never;

type _ShapeOf<D> =
  D extends Raw<infer S>
    ? S
    : D extends readonly (infer E)[]
      ? IsUnion<E> extends true
        ? ["i..."]
        : ["i", ...ContainerTail<E>]
      : D extends object
        ? IsUnion<D[keyof D]> extends true
          ? ["k..."]
          : ["k", ...ContainerTail<D[keyof D]>]
        : [];

// Leaf stops at []; containers recurse one level.
type ContainerTail<E> = [unknown] extends [E]
  ? []
  : E extends readonly unknown[]
    ? _ShapeOf<E>
    : E extends object
      ? _ShapeOf<E>
      : [];

// Gate on the never sentinel, not X extends Shape — never extends Shape
// is true, so the naive form accepts every call on failure.
export type Check<In extends Shape, D> = [MatchesIn<In, ShapeOf<D>>] extends [
  never,
]
  ? never
  : unknown;
