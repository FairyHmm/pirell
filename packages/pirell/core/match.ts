import type {
  Branch,
  Dim,
  Elem,
  MixedTag,
  Raw,
  Shape,
  Variants,
} from "./types.js";

// Shape-matching primitive. Depends only on the Shape vocabulary, not on
// Op/Pirell/Wrapper/Deferred — any wiring pattern (fluent, pipe, custom)
// can check a Shape against another Shape without adopting assemble.ts.

type DimOf<T extends MixedTag> = T extends `${infer D extends Dim}...`
  ? D
  : never;

// Canonical form for comparison: each Elem reduces to { dim, uniform }.
// "i"/"k" → leaf, "i..."/"k..." → mixed, [dim, Branch] → typed uniform,
// [mixedTag, variants] → typed mixed. "i" ≠ "i..." — different uniform.
type Normalize<E extends Elem> = E extends Dim
  ? { dim: E; uniform: "leaf" }
  : E extends MixedTag
    ? { dim: DimOf<E>; uniform: "mixed" }
    : E extends [infer D extends Dim, infer B extends Branch]
      ? { dim: D; uniform: B }
      : E extends [infer T extends MixedTag, infer V extends Variants]
        ? { dim: DimOf<T>; uniform: V }
        : never;

// Whether an In element matches an Actual element at the same position:
// both sides normalized, then compared by mutual `extends`.
type ElemMatches<InE extends Elem, ActualE extends Elem> =
  Normalize<ActualE> extends Normalize<InE>
    ? Normalize<InE> extends Normalize<ActualE>
      ? true
      : false
    : false;

// "..." reached → open tail succeeds. Must come before the Head/Tail
// branch since "..." is a string literal, not an Elem.
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

// Driven by "..." in In — if present, open tail succeeds; otherwise exact
// match required.
export type MatchesIn<In extends Shape, Actual extends Shape> =
  MatchesShape<In, Actual> extends true ? Actual : never;

// --- Call-site shape inference (see shape-inference.md) ---
//
// ShapeOf<D> derives a Shape from a value's static type, so a bare
// literal can be checked at the call site with no `as Raw<S>` cast.

// True iff T is a genuine union (distributive-conditional trick: naked
// T distributes over the union, so [U] extends [T] fails when T had >1
// member).
type IsUnion<T, U = T> = T extends U ? ([U] extends [T] ? false : true) : never;

// ShapeOf<D> derives a Shape from a value's static type. The recheck
// against Shape isn't insurance against a wrong runtime answer — every
// branch below is already Shape-shaped by construction — it's required
// for tsc's own inference: Check<In, D> below feeds ShapeOf<D> into
// MatchesIn<In extends Shape, Actual extends Shape>, and tsc can't carry
// the Shape constraint through an un-rechecked conditional type into that
// call site (confirmed: removing the recheck breaks Check's own
// declaration with a real "not assignable to Shape" error, not a
// hypothetical one).
//
// A container whose element type is a genuine union is heterogeneous by
// construction — e.g. `[["a",1],["b",2]]` infers each row as
// `(string|number)[]`, not a tuple, so that row is "i...". Structural
// fact, not a reinterpretation — no exceptions per literal shape.
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

// Tail for the already-uniform case: leaf stops at [], container
// recurses one level.
type ContainerTail<E> = [unknown] extends [E]
  ? []
  : E extends readonly unknown[]
    ? _ShapeOf<E>
    : E extends object
      ? _ShapeOf<E>
      : [];

// Must discriminate on the never sentinel itself ([X] extends [never]),
// not X extends Shape — never extends Shape is true, which would
// accept every call on failure.
export type Check<In extends Shape, D> = [MatchesIn<In, ShapeOf<D>>] extends [
  never,
]
  ? never
  : unknown;
