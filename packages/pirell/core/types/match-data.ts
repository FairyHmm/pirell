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
// evaluation feeds the dim check, the kind check, the descent, and the
// emptiness check: an empty container descends to never (no elements, no
// property values), so MatchData's terminal arm reads "empty" off .value
// instead of a second structural walk. Always tuple-wrap at use sites: a
// non-container D yields never, and bare never matches everything.
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

// A consumed Head leaves nothing ([]) or an open tail (["..."]) behind.
type TailOk<Tail extends Shape> = Tail extends []
  ? true
  : Tail extends ["..."]
    ? true
    : false;

export type MatchData<In extends Shape, D> = In extends []
  ? [NormalizeData<D>] extends [never]
    ? false // not a container at all — never matches every object arm vacuously, so guard first
    : [NormalizeData<D>] extends [{ value: never }]
      ? true // container with nothing inside
      : false
  : In extends ["..."]
    ? true
    : In extends [infer InHead extends Elem, ...infer InTail extends Shape]
      ? MatchHead<InHead, InTail, D>
      : false;

// Head normalized once: dim to match, expected kind, optional declared
// payload. One evaluation replaces the four per-arm NormalizeData checks
// (bare dim / mixed tag / declared payload / mixed variants each re-spelled
// the dim+kind test with its own DimTable lookup). Bare dims descend —
// their tail is the container's value-shape — everything else is terminal.
// (Normalize from match-shape.ts can't drive this: it erases bare-vs-
// declared — Normalize<"i"> and Normalize<["i","leaf"]> coincide — while
// the continuation depends on exactly that distinction.)
type HeadKind<Head extends Elem> = Head extends Dim
  ? { dim: Head; kind: "leaf"; branch: never }
  : Head extends MixedTag
    ? { dim: DimTable[Head]; kind: "mixed"; branch: never }
    : Head extends [infer ID extends Dim, infer B extends Branch]
      ? { dim: ID; kind: "leaf"; branch: B }
      : Head extends [infer IT extends MixedTag, infer _V extends Variants]
        ? { dim: DimTable[IT]; kind: "mixed"; branch: never }
        : never;

type MatchHead<Head extends Elem, InTail extends Shape, D> = [
  HeadKind<Head>,
] extends [never]
  ? false
  : HeadKind<Head> extends {
        dim: infer HDim;
        kind: infer HKind;
        branch: infer Br;
      }
    ? [NormalizeData<D>] extends [{ dim: HDim; uniform: HKind; value: infer V }]
      ? [Br] extends [never]
        ? HKind extends "mixed"
          ? TailOk<InTail>
          : TailOk<InTail> extends true
            ? true
            : MatchData<InTail, V>
        : MatchBranch<Extract<Br, Branch>, V> extends true
          ? TailOk<InTail>
          : false
      : false
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
