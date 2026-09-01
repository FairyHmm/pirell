import type {
  Branch,
  Dim,
  Elem,
  MixedTag,
  Raw,
  Shape,
  Variants,
} from "./types.js"; // same-dir, unchanged

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

// Single-direction: Actual must extend In. Elem is closed — if a new arm is
// added to Elem/Normalize, verify its output is not a subtype of an existing arm.
type ElemMatches<InE extends Elem, ActualE extends Elem> =
  Normalize<ActualE> extends Normalize<InE> ? true : false;

// "..." → open tail succeeds; must precede Head/Tail since "..." isn't an Elem.
export type MatchesShape<In extends Shape, Actual extends Shape> = In extends []
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

export type Check<In extends Shape, D> =
  MatchesShape<In, ShapeOf<D>> extends true ? unknown : never;
