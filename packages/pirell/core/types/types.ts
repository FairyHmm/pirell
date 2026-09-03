// --- Dim & Elem representation ---

export type Dim = "i" | "k";

// Branch: nested Shape, leaf type, or object — `unknown` excluded because it
// absorbs unions and collapses comparisons.
export type Branch =
  Shape | (string & {}) | (number & {}) | (boolean & {}) | object;

// JSON's positional vs. named fork for a Mixed node's children, kept
// distinct rather than force-unified.
export type Variants = Branch[] | Record<string, Branch>;

// "i..."/"k..." = Dim + heterogeneous children.
export type MixedTag = `${Dim}...`;

// Elem: dim, mixed tag, or a [dim, Branch] / [mixedTag, variants] pair.
export type Elem = Dim | MixedTag | [Dim, Branch] | [MixedTag, Variants];

// Open-tail applies only to nested Shape; Mixed/MixedTag are terminal.
export type Shape = Elem[] | [...Elem[], "..."];

// --- Data / Op ---

// DataOf<S>: shape → concrete TS type, inverse of ShapeOf. A Shape's
// elements form one recursive descent, not siblings — ["k",["i",number]]
// is "keyed container of arrays of number" — mirroring _ShapeOfContainer
// in match.ts. See PLAN.md's brand-removal notes for the derivation.
export type DataOf<S extends Shape> = S extends []
  ? unknown
  : S extends ["..."]
    ? unknown
    : S extends [infer Head extends Elem, ...infer Rest extends Shape]
      ? DataOfElem<Head, Rest>
      : unknown;

// Rest only matters when Head is a bare Dim/MixedTag (no Branch payload);
// then Rest is itself the nested Shape for the container's contents.
type DataOfElem<E extends Elem, Rest extends Shape> = E extends "i"
  ? Rest extends []
    ? unknown[]
    : DataOf<Rest>[]
  : E extends "k"
    ? Rest extends []
      ? Record<string, unknown>
      : DataOf<Rest> extends infer V
        ? Record<string, V>
        : never
    : E extends "i..."
      ? unknown[]
      : E extends "k..."
        ? Record<string, unknown>
        : E extends [infer D extends Dim, infer B extends Branch]
          ? D extends "i"
            ? B extends Shape
              ? DataOf<B>[]
              : B[]
            : B extends Shape
              ? Record<string, DataOf<B>>
              : Record<string, B>
          : E extends [infer T extends MixedTag, infer _V extends Variants]
            ? DimOf<T> extends "i"
              ? unknown[]
              : Record<string, unknown>
            : unknown;

type DimOf<T extends MixedTag> = T extends `${infer D extends Dim}...`
  ? D
  : never;

// Raw<S> = DataOf<S> & optional brand, not a bare phantom — this is what
// lets a prior op's Raw<In> output satisfy the next op's DataOf<In> param
// with zero cast (PLAN.md: brand-removal). The [unknown] extends
// [DataOf<S>] guard covers S=[]/["..."]: `unknown & X` collapses to X, and
// a primitive return value has no properties in common with a bare
// optional-key object — so with no shape claim, Raw<S> stays unbranded
// unknown rather than an unsatisfiable object type.
declare const __shapeBrand: unique symbol;
export type Raw<S extends Shape> = [unknown] extends [DataOf<S>]
  ? unknown
  : DataOf<S> & { readonly [__shapeBrand]?: S };

// Op is always curried: (...args) => (data: DataOf<In>) => Raw<Out>.
// __pirell brand is gone; thunk-vs-plain-fn discrimination is structural
// (arity), handled in compose.ts, not nominal — see PLAN.md.
export type Op<
  In extends Shape,
  Out extends Shape,
  Args extends unknown[] = [],
> = (...args: Args) => (data: DataOf<In>) => Raw<Out>;

// Not `this`-typed: closes over the op at attach time, then narrows on each
// .extend() so the pre-call shape no longer matches.
export type Fluent<F extends Op<any, any, any>> =
  F extends Op<any, infer Out, any> ? () => Bound<Out> : never;

// Type-level tag for a data-bound surface. Forward-declared here to avoid
// a circular dependency; named Bound (not Wrapper) so it doesn't collide
// with the runtime class of the same concept (see type-safety.md).
export interface Bound<S extends Shape> {
  readonly __shape?: S;
  value: unknown;
}

// A Deferred is a lazy raw-JSON transform: calling it runs the pipeline
// on opaque input and returns a data-bound surface of shape Out. value is
// typed undefined (matching assemble.ts) since no data is bound yet.
export interface Deferred<Out extends Shape> {
  (data: unknown): Bound<Out>;
  readonly value: undefined;
}
