// --- Dim & Elem representation ---

export type Dim = "i" | "k";

// Branch: nested Shape, leaf type, or object — `unknown` deliberately
// excluded because it absorbs unions and collapses comparisons.
export type Branch =
  Shape | (string & {}) | (number & {}) | (boolean & {}) | object;

// Positional/named variant forms for a Mixed node's children.
// Array vs. object is JSON's own fork — kept as a union, not force-unified.
export type Variants = Branch[] | Record<string, Branch>;

// MixedTag derives from Dim rather than being a second hand-written
// literal union: "i..."/"k..." is just Dim + "this node has
// heterogeneous children", not an independent concept.
export type MixedTag = `${Dim}...`;
type DimOf<T extends MixedTag> = T extends `${infer D extends Dim}...`
  ? D
  : never;

// Elem: dim, mixed tag, or a [dim, Branch] / [mixedTag, variants] pair.
export type Elem = Dim | MixedTag | [Dim, Branch] | [MixedTag, Variants];

// Open-tail applies only to nested Shape; Mixed/MixedTag are terminal.
export type Shape = Elem[] | [...Elem[], "..."];

// --- Data / Op ---

// Shape is compile-time only — value is untyped JSON data. data is
// always JSON, and Shape is already a simplified top-down view of it
// (see data-model.md), so a second value-type parameter would just
// restate what the shape stack already describes; each Op narrows
// data.value internally as needed. __shape is a phantom marker (see Op).
export type Pirell<S extends Shape> = {
  readonly __shape?: S;
  value: unknown;
};

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

// Driven by "..." in In — if present, open tail succeeds; otherwise exact
// match required.
export type MatchesIn<In extends Shape, Actual extends Shape> =
  MatchesShape<In, Actual> extends true ? Actual : never;

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

// Op is phantom-typed: __in/__out anchor In/Out into a structural
// position TS actually compares. No T/R — In/Out are the sole source
// of truth, not a second value-type channel that could silently
// disagree with the shape. LOAD-BEARING: removing __in/__out lets a
// wrong-shape Op through with no error (verified) — every rejection
// test in types.test.ts depends on them.
export type Op<
  In extends Shape,
  Out extends Shape,
  Args extends any[] = [],
> = ((data: Pirell<In>, ...args: Args) => Pirell<Out>) & {
  readonly __in?: In;
  readonly __out?: Out;
};

// Not `this`-typed: method closes over op at attach time,
// then narrows on each .extend() so pre-call shape no longer matches.
export type Fluent<F extends Op<any, any, any>> =
  F extends Op<any, infer Out, infer Args>
    ? (...args: Args) => Wrapper<Out>
    : never;

// Forward declaration to avoid circular dependency.
// No runtime `shape` field — see Pirell above.
export interface Wrapper<S extends Shape> {
  readonly __shape?: S;
  value: unknown;
}

export interface Deferred<In extends Shape, Out extends Shape> {
  (data: Pirell<In>): Pirell<Out>;
}
