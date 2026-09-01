import type { Check } from "./match.js";

// --- Dim & Elem representation ---

export type Dim = "i" | "k";

// Branch: nested Shape, leaf type, or object — `unknown` excluded because it
// absorbs unions and collapses comparisons.
export type Branch =
  Shape | (string & {}) | (number & {}) | (boolean & {}) | object;

// Positional/named variant forms for a Mixed node's children; array vs.
// object is JSON's own fork, kept as a union rather than force-unified.
export type Variants = Branch[] | Record<string, Branch>;

// MixedTag derives from Dim: "i..."/"k..." is just Dim + "heterogeneous children".
export type MixedTag = `${Dim}...`;

// Elem: dim, mixed tag, or a [dim, Branch] / [mixedTag, variants] pair.
export type Elem = Dim | MixedTag | [Dim, Branch] | [MixedTag, Variants];

// Open-tail applies only to nested Shape; Mixed/MixedTag are terminal.
export type Shape = Elem[] | [...Elem[], "..."];

// --- Data / Op ---

// Raw<S> is a branded phantom: at runtime it IS the raw JSON value, no
// wrapper. Interface (not `unknown & {brand}`) to stay a real structural
// check instead of collapsing to `unknown` and erasing S.
declare const __shapeBrand: unique symbol;
export interface Raw<S extends Shape> {
  readonly [__shapeBrand]?: S;
}

// Op: always curried — (...args) => (data) => Raw<Out>, shape-gated at the
// data-application step. Args may be empty ([]); there is no separate
// zero-arg shape. Internal call sites (compose/pipe/extend/assemble) only
// ever consume this curried form — makeFlat exists solely to cross the
// export boundary to a flat (data, ...args) => result caller.
// Data is a gated generic rather than Raw<In> — data has no declared shape,
// ops derive it (see shape-inference.md). __in/__out anchor In/Out for
// comparison — load-bearing.
export type Op<
  In extends Shape,
  Out extends Shape,
  Args extends unknown[] = [],
> = ((...args: Args) => <D>(data: D & Check<In, D>) => Raw<Out>) & {
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
