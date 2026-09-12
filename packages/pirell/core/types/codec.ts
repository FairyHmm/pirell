import type {
  Branch,
  Dim,
  Elem,
  MixedTag,
  Shape,
  Variants,
} from "./base.js";

// Bidirectional Shape mapping, side by side: forwards (Shape → type)
// first, backwards (type → Shape) second.

// --- Shape → type ---

// DataOf<S>: shape → concrete TS type, inverse of ShapeOf below. A
// Shape's elements form one recursive descent, not siblings —
// ["k",["i",number]] is "keyed container of arrays of number".
export type DataOf<S extends Shape> = S extends []
  ? unknown
  : S extends ["..."]
    ? unknown
    : S extends [infer Head extends Elem, ...infer Rest extends Shape]
      ? DataOfElem<Head, Rest>
      : unknown;

// Dim→container mapping, stated once. Indexed only by narrowed Dim
// (TS can't see through a deferred lookup).
type Container<D extends Dim, V> = { i: V[]; k: Record<string, V> }[D];

// Bare mixed tags carry no payload — fixed result per tag, read off a
// table (result position needs no constraint, so the generic lookup is
// fine here).
type MixedBare<T extends MixedTag> = {
  "i...": unknown[];
  "k...": Record<string, unknown>;
}[T];

type DataOfElem<E extends Elem, Rest extends Shape> = E extends Dim
  ? Container<E, DataOf<Rest>>
  : E extends MixedTag
    ? MixedBare<E>
    : E extends [infer D extends Dim, infer B extends Branch]
      ? B extends Shape
        ? Container<D, DataOf<B>>
        : Container<D, B>
      : E extends [infer T extends MixedTag, infer _V extends Variants]
        ? MixedBare<T>
        : unknown;

// --- Type → Shape ---

// Derives a Shape from a bare literal so calls need no `as Raw<S>` cast.
// Used by chain.ts where no declared Op exists (bare-thunk/plain-fn link
// outputs).

// True iff T is a genuine union (naked-T distributive trick).
export type IsUnion<T, U = T> = T extends U
  ? [U] extends [T]
    ? false
    : true
  : never;

// Single-evaluates ShapeOfElem via infer R (re-spelling it cost ~2.5x)
// and narrows the result to Shape.
export type ShapeOf<D> = ShapeOfElem<D> extends infer R extends Shape
  ? R
  : never;

// Concrete enough to encode as a Branch: not unknown/any, not a union
// (those go mixed), not a container (those recurse). Lets `[1,2,3]`
// derive [["i", number]] so a Branch-claiming op accepts a bare literal.
type IsConcreteLeaf<E> = [unknown] extends [E]
  ? false
  : IsUnion<E> extends true
    ? false
    : E extends readonly unknown[]
      ? false
      : E extends object
        ? false
        : true;

// The brand-recovery detour (checking D for ShapeBrand and returning a
// prior Raw<S>'s S verbatim) was removed: pirell(data)'s only real call
// site never receives a genuinely branded value (Bound<S>.value is typed
// unknown, not Raw<S>), and structural re-derivation already recovers
// the correct shape for every case tried, including mixed-tag and nested
// containers (see types.test.ts) — ~5/site cheaper with no behavior
// change (verified: 108/108 tests, obj-wrap 71→66, obj-pirell 35→30).
type ShapeOfElem<D> = D extends readonly (infer E)[]
  ? IsUnion<E> extends true
    ? ["i..."]
    : IsConcreteLeaf<E> extends true
      ? [["i", E]]
      : ["i", ...ContainerTail<E>]
  // Uniform-first: concrete-leaf before union, so the common case
  // skips IsUnion entirely.
  : D extends object
    ? IsConcreteLeaf<D[keyof D]> extends true
      ? [["k", D[keyof D]]]
      : IsUnion<D[keyof D]> extends true
        ? ["k..."]
        : ["k", ...ContainerTail<D[keyof D]>]
    : [];

type ContainerTail<E> = [unknown] extends [E]
  ? []
  : E extends readonly unknown[]
    ? ShapeOfElem<E>
    : E extends object
      ? ShapeOfElem<E>
      : [];
