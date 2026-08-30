import type { Check } from "./match.js";

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

// Elem: dim, mixed tag, or a [dim, Branch] / [mixedTag, variants] pair.
export type Elem = Dim | MixedTag | [Dim, Branch] | [MixedTag, Variants];

// Open-tail applies only to nested Shape; Mixed/MixedTag are terminal.
export type Shape = Elem[] | [...Elem[], "..."];

// --- Data / Op ---

// Raw<S> is a branded phantom type: at runtime it IS the raw JSON value,
// no wrapper. Interface (not `unknown & {brand}`) so it stays a real
// structural check instead of collapsing to `unknown` and erasing S.
declare const __shapeBrand: unique symbol;
export interface Raw<S extends Shape> {
  readonly [__shapeBrand]?: S;
}

// Dual-form: data-first `op(data, ...args)` or curried `op(...args)(data)`.
// Args=[] collapses to a plain signature; non-empty needs op()'s dispatcher.
//
// Data param is a gated generic (`D & Check<In, D>`), not `Raw<In>` —
// data has no declared shape, ops derive it via ShapeOf and check
// against In (see shape-inference.md). Impls need `(data: unknown)`
// since the generic signature drops contextual typing.
//
// __in/__out anchor In/Out for direct comparison — load-bearing, don't
// remove (a wrong-shape Op would pass silently otherwise).
export type Op<
  In extends Shape,
  Out extends Shape,
  Args extends any[] = [],
> = ([Args] extends [[]]
  ? <D>(data: D & Check<In, D>) => Raw<Out>
  : (<D>(data: D & Check<In, D>, ...args: Args) => Raw<Out>) &
      ((...args: Args) => <D>(data: D & Check<In, D>) => Raw<Out>)) & {
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
export interface Wrapper<S extends Shape> {
  readonly __shape?: S;
  value: unknown;
}

// A Deferred is a lazy raw-JSON transform. Calling it with raw data runs
// its pipeline and returns a data-bound surface whose value has shape Out.
// The input data is opaque JSON, so only the output shape is represented.
export interface Deferred<Out extends Shape> {
  (data: unknown): Wrapper<Out>;
}
