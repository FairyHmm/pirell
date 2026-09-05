import type { Branch, Elem, ElemCase, Shape } from "./base.js";
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
  : // Keyed values read off string|number keys only: JSON is string-keyed,
    // and Raw's optional brand is a symbol — without the Extract it pollutes
    // the value union (flipping uniform to mixed) for branded inputs.
    D extends object
    ? {
        dim: "k";
        uniform: IsUnion<D[Extract<keyof D, string | number>]> extends true
          ? "mixed"
          : "leaf";
        value: D[Extract<keyof D, string | number>];
      }
    : never;

// Unknown is opaque: it proves nothing and disproves nothing. A value
// involving unknown (directly, or nested in an array/object) can't disprove
// a mixed ("heterogeneous children") claim, so it satisfies a mixed
// expectation the uniform check rejects (e.g. toEntries' own unknown[][]
// output at ["i","i..."]).
type InvolvesUnknown<V> = [unknown] extends [V]
  ? true
  : V extends readonly (infer I)[]
    ? InvolvesUnknown<I>
    : V extends object
      ? InvolvesUnknown<V[Extract<keyof V, string | number>]>
      : false;

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

// The head goes through the canonical ElemCase; the continuation branches
// off its fields. Bare dims descend — their tail is the container's
// value-shape — everything else is terminal, with a declared Branch
// checked per value.
type MatchHead<Head extends Elem, InTail extends Shape, D> = [
  ElemCase<Head>,
] extends [never]
  ? false
  : [NormalizeData<D>] extends [
        {
          dim: ElemCase<Head>["dim"];
          uniform: ElemCase<Head>["kind"];
          value: infer V;
        },
      ]
    ? [ElemCase<Head>["branch"]] extends [never]
      ? ElemCase<Head>["kind"] extends "mixed"
        ? TailOk<InTail>
        : TailOk<InTail> extends true
          ? true
          : MatchData<InTail, V>
      : MatchBranch<Extract<ElemCase<Head>["branch"], Branch>, V> extends true
        ? TailOk<InTail>
        : false
    : // Opacity fallback (expected-mixed only): re-match on dim alone and
      // accept opaque values. Mixed-kind continuations never descend (branch
      // is always never where kind is mixed), so this is exactly TailOk —
      // and DataOf of a bare-mixed shape accepts every dim-matching D, so it
      // never admits what the body can't handle.
      ElemCase<Head>["kind"] extends "mixed"
      ? [NormalizeData<D>] extends [
          { dim: ElemCase<Head>["dim"]; value: infer V },
        ]
        ? InvolvesUnknown<V> extends true
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
