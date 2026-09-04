import type {
  Branch,
  Dim,
  DimTable,
  Elem,
  MixedTag,
  Shape,
  Variants,
} from "./base.js";
import type { IsUnion } from "./codec.js";

// Shape-vs-Data matching. Fused inference+match: walks In's Elem-list
// against D's structure directly, never materializing D's own Shape.
// Mirrors DataOf's descent (codec.ts): a bare-dim Head hands the tail
// down as the container's own value-shape, while a declared-payload Head
// consumes only that one Elem. Feeds CheckData (Op gate) and chain links.

// D's dim+kind+descent in one test — the data-side mirror of Normalize's
// {dim, uniform} for an Elem, with the descended type attached. One
// evaluation feeds the dim check, the kind check, and the descent.
// Always tuple-wrap at use sites: a non-container D yields never, and
// bare never matches everything.
type NormalizeData<D> = D extends readonly (infer E)[]
  ? {
      dim: "i";
      uniform: IsUnion<E> extends true ? "mixed" : "leaf";
      value: E;
    }
  : D extends object
    ? {
        dim: "k";
        uniform: IsUnion<D[keyof D]> extends true ? "mixed" : "leaf";
        value: D[keyof D];
      }
    : never;

// D has no properties / no elements — the empty-array-or-object shape.
type IsEmptyIsh<D> = D extends readonly unknown[]
  ? D extends readonly []
    ? true
    : false
  : D extends object
    ? keyof D extends never
      ? true
      : false
    : false;

// A consumed Head leaves nothing ([]) or an open tail (["..."]) behind.
type TailOk<Tail extends Shape> = Tail extends []
  ? true
  : Tail extends ["..."]
    ? true
    : false;

export type MatchData<In extends Shape, D> = In extends []
  ? IsEmptyIsh<D> extends true
    ? true
    : false
  : In extends ["..."]
    ? true
    : In extends [infer InHead extends Elem, ...infer InTail extends Shape]
      ? MatchHead<InHead, InTail, D>
      : false;

type MatchHead<Head extends Elem, InTail extends Shape, D> = Head extends Dim
  ? MatchBareDim<Head, InTail, D>
  : Head extends MixedTag
    ? MatchMixed<Head, InTail, D>
    : Head extends [infer ID extends Dim, infer B extends Branch]
      ? MatchDeclared<ID, B, InTail, D>
      : Head extends [infer IT extends MixedTag, infer _V extends Variants]
        ? MatchMixedVariants<IT, InTail, D>
        : false;

// Bare "i"/"k": dim+leaf in one NormalizeData test, then descend into .value.
type MatchBareDim<IDim extends Dim, InTail extends Shape, D> = [
  NormalizeData<D>,
] extends [{ dim: IDim; uniform: "leaf"; value: infer V }]
  ? TailOk<InTail> extends true
    ? true
    : MatchData<InTail, V>
  : false;

// Mixed tags are terminal — the tail, if present, is an open "...".
// Expected dim comes off DimTable, same lookup Normalize uses.
type MatchMixed<IT extends MixedTag, InTail extends Shape, D> = [
  NormalizeData<D>,
] extends [{ dim: DimTable[IT]; uniform: "mixed" }]
  ? TailOk<InTail>
  : false;

// Declared payload fully claims this Elem: no further siblings allowed.
type MatchDeclared<
  ID extends Dim,
  B extends Branch,
  InTail extends Shape,
  D,
> = [NormalizeData<D>] extends [{ dim: ID; uniform: "leaf"; value: infer V }]
  ? MatchBranch<B, V> extends true
    ? TailOk<InTail>
    : false
  : false;

// Mixed variants declare no checkable payload — kind match only.
type MatchMixedVariants<IT extends MixedTag, InTail extends Shape, D> = [
  NormalizeData<D>,
] extends [{ dim: DimTable[IT]; uniform: "mixed" }]
  ? TailOk<InTail>
  : false;

// Nested Shape recurses without materializing D's own Shape; a leaf type
// compares structurally (both directions — same strictness as Normalize).
type MatchBranch<B extends Branch, V> = B extends Shape
  ? MatchData<B, V>
  : [V] extends [B]
    ? [B] extends [V]
      ? true
      : false
    : false;

// Narrowing gate: the data-side counterpart of CheckShape (which narrows
// Shape×Shape). Checks D against In, usable as data or never.
export type CheckData<In extends Shape, D> =
  MatchData<In, D> extends true ? unknown : never;
