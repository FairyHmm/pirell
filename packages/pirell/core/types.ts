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

// Dual-form: data-first `op(data, ...args)` or curried
// `op(...args)(data)` (data last). Fixed-arity Args only — dispatch by
// arguments.length needs a known length (see op() in extend.ts).
//
// Args=[] collapses to one plain signature: nothing to curry, so a
// plain function/arrow assigns directly, no factory needed. Non-empty
// Args needs op()'s dispatcher — one function can't have two arities.
//
// __in/__out anchor In/Out for TS to compare directly (no T/R value
// channel). LOAD-BEARING: without them a wrong-shape Op passes silently.
export type Op<
  In extends Shape,
  Out extends Shape,
  Args extends any[] = [],
> = ([Args] extends [[]]
  ? (data: Raw<In>) => Raw<Out>
  : ((data: Raw<In>, ...args: Args) => Raw<Out>) &
      ((...args: Args) => (data: Raw<In>) => Raw<Out>)) & {
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
