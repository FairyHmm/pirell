import type { Check } from "./match.js";

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

// Raw<S> is a branded phantom — at runtime it IS the raw JSON value. An
// interface (not `unknown & {brand}`) stays a real structural check instead
// of collapsing to `unknown`.
declare const __shapeBrand: unique symbol;
export interface Raw<S extends Shape> {
  readonly [__shapeBrand]?: S;
}

// Op is always curried: (...args) => (data: gated) => Raw<Out>; Args may be
// empty — there is no separate zero-arg shape. Data is a gated generic, not
// Raw<In>, because data has no declared shape (ops derive it —
// shape-inference.md); __in/__out keep In/Out comparable. __pirell is a
// required compile-time discriminant — without it a bare (x: any) => any
// leniently matches Op<infer...> in the chain helpers and collapses chains
// to never (BUGS.md #12); authoring supplies it with a trailing
// `as Op<In,Out>` cast (type-level only).
export type Op<
  In extends Shape,
  Out extends Shape,
  Args extends unknown[] = [],
> = ((...args: Args) => <D>(data: D & Check<In, D>) => Raw<Out>) & {
  readonly __pirell: "op";
  readonly __in?: In;
  readonly __out?: Out;
};

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
