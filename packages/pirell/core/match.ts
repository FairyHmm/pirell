import type { Branch, Dim, Elem, MixedTag, Shape, Variants } from "./types.js";

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
