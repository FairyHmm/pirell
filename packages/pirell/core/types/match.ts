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
//
// A bare InE (Dim/MixedTag, no declared Branch/Variants payload) is a
// wildcard at the payload position: it claims only dim+kind (leaf vs
// mixed), so any ActualE of matching dim+kind satisfies it regardless of
// how specific ActualE's own payload is — "more detail is welcome if the
// op doesn't need it" (PLAN.md). A declared InE (has a payload) makes a
// real claim and still requires strict structural agreement, so a bare or
// mismatched-payload ActualE is correctly rejected either direction.
type ElemMatches<InE extends Elem, ActualE extends Elem> = InE extends Dim | MixedTag
  ? Normalize<ActualE>["dim"] extends Normalize<InE>["dim"]
    ? KindOf<ActualE> extends KindOf<InE>
      ? true
      : false
    : false
  : Normalize<ActualE> extends Normalize<InE>
    ? true
    : false;

// leaf vs mixed, independent of dim — a bare "i" must still reject "i..."
// (and vice versa), and a declared ["i", B] must still reject ["i...", V].
type KindOf<E extends Elem> = E extends MixedTag | [MixedTag, Variants]
  ? "mixed"
  : "leaf";

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

// Raw<S>'s brand is `[__shapeBrand]?: S` (optional) so `as Raw<S>` can cast
// a plain literal that structurally has no such property (types.ts). But
// that optionality means ANY index-signature object type (Record<string,
// T>) vacuously "has" the optional symbol property too — `D extends
// Raw<infer S>` incorrectly matches, infers S as unconstrained Shape, and
// _ShapeOf collapses to the whole Shape union instead of a real shape.
// Named-property object types don't hit this (their fixed key set doesn't
// vacuously satisfy an unrelated symbol key), only index-signature types
// do — so exclude those before the Raw check runs, rather than changing
// Raw itself (which would break the `as Raw<S>` cast pattern used
// throughout ops authoring).
type HasStringIndex<T> = string extends keyof T ? true : false;

// A leaf is "concrete" enough to encode as a Branch if it isn't
// unknown/any, isn't a genuine union (those go to the mixed tail instead),
// and isn't itself a container (those recurse via ContainerTail). Lets a
// bare literal like `[1,2,3]` derive [["i", number]] instead of stopping
// at bare "i" — so an op that genuinely claims a Branch (e.g. double's
// arithmetic body) can still be satisfied by a bare literal, no `as Raw<S>`
// needed. Data has no inherent shape; this only widens what a bare
// literal's own static type can prove to the op checking it.
type IsConcreteLeaf<E> = [unknown] extends [E]
  ? false
  : IsUnion<E> extends true
    ? false
    : E extends readonly unknown[]
      ? false
      : E extends object
        ? false
        : true;

type _ShapeOf<D> = HasStringIndex<D> extends true
  ? _ShapeOfContainer<D>
  : D extends Raw<infer S>
    ? S
    : _ShapeOfContainer<D>;

type _ShapeOfContainer<D> = D extends readonly (infer E)[]
  ? IsUnion<E> extends true
    ? ["i..."]
    : IsConcreteLeaf<E> extends true
      ? [["i", E]]
      : ["i", ...ContainerTail<E>]
  : D extends object
    ? IsUnion<D[keyof D]> extends true
      ? ["k..."]
      : IsConcreteLeaf<D[keyof D]> extends true
        ? [["k", D[keyof D]]]
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
