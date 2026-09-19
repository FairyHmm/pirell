import type { Branch, Dim, Elem, MixedTag, Shape, Variants } from "./base.js";

// Bidirectional Shape mapping, side by side: forwards (Shape → type)
// first, backwards (type → Shape) second.

// --- Shape → type ---

/**
 * Maps a shape to its concrete TS type, inverse of {@linkcode ShapeOf}.
 * A shape's elements form one recursive descent, not siblings:
 * `["k", ["i", number]]` is "keyed container of arrays of number".
 */
export type DataOf<S extends Shape> = S extends []
  ? unknown
  : S extends ["..."]
    ? unknown
    : S extends [infer Head extends Elem, ...infer Rest extends Shape]
      ? DataOfElem<Head, Rest>
      : unknown;

// Dim→container mapping, stated once (indexed only by narrowed Dim —
// TS can't see through a deferred lookup).
type Container<D extends Dim, V> = { i: V[]; k: Record<string, V> }[D];

// Bare mixed tags carry no payload — fixed result per tag.
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

// Shape from a bare literal, where no declared Op exists to read from.

// True iff T is a genuine union (naked-T distributive trick).
export type IsUnion<T, U = T> = T extends U
  ? [U] extends [T]
    ? false
    : true
  : never;

/**
 * Derives a shape from a bare literal, so calls need no `as Raw<S>`
 * cast. Inverse of {@linkcode DataOf}: same ladder, opposite
 * direction.
 */
export type ShapeOf<D> =
  ShapeOfElem<D> extends infer R extends Shape ? R : never;

// Not unknown/any, not a union (those go mixed), not a container
// (those recurse).
type IsConcreteLeaf<E> = [unknown] extends [E]
  ? false
  : IsUnion<E> extends true
    ? false
    : E extends readonly unknown[]
      ? false
      : E extends object
        ? false
        : true;

// No branded-value special case: `Bound<S>.value` is unknown, and
// structural re-derivation recovers the shape for every tried case.
type ShapeOfElem<D> = D extends readonly (infer E)[]
  ? IsUnion<E> extends true
    ? ["i..."]
    : IsConcreteLeaf<E> extends true
      ? [["i", E]]
      : ["i", ...ContainerTail<E>]
  : // Concrete-leaf before union: the common case skips IsUnion.
    // Fixed heterogeneous leaf rows are tables, not mixed.
    D extends object
    ? IsConcreteLeaf<D[keyof D]> extends true
      ? [["k", D[keyof D]]]
      : D[keyof D] extends string | number | boolean
        ? [["k", D]]
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
