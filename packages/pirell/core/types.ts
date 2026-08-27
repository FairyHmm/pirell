export type Dim = "i" | "k";

// Named dims: full form of 'i'/'k' carrying element/value type information.
export type Indexed<T> = { readonly __indexed: T };
export type Keyed<T> = { readonly __keyed: T };

// Use ShapeElem[] wherever a shape is expected; Dim only for a single dim value.
export type ShapeElem =
  Dim | Indexed<any> | Keyed<any> | Mixed<Dim, ShapeElem[][]>;

export type Pirell<S extends ShapeElem[], T> = {
  shape: S;
  value: T;
};

// Bound shape: prefix is asserted, remainder is wildcard.
// S can contain Mixed elements — e.g. [Mixed<"k">, "i", ...].
export type Continued<S extends ShapeElem[]> = S & {
  readonly __continued: true;
};

// Mixed dim: a D-keyed node whose children are non-uniform.
export type Mixed<
  D extends Dim,
  Variants extends ShapeElem[][] = ShapeElem[][],
> = {
  readonly __mixed: D;
  readonly __variants: Variants;
};

// Check brand directly: `S extends Continued<any>` always resolves to true
export type IsContinued<S extends ShapeElem[]> = S extends {
  readonly __continued: true;
}
  ? true
  : false;

// Strips the Continued brand back down to a plain ShapeElem[] for structural checks.
type Bare<S extends ShapeElem[]> = S extends Continued<infer B> ? B : S;

// Whether an In element matches an Actual element at the same position.
type ElemMatches<InE extends ShapeElem, ActualE extends ShapeElem> =
  InE extends Mixed<infer D>
    ? ActualE extends D
      ? true
      : false
    : InE extends Indexed<infer IT>
      ? ActualE extends Indexed<infer AT>
        ? AT extends IT
          ? true
          : false
        : ActualE extends "i"
          ? IT extends unknown
            ? true
            : false
          : false
      : InE extends Keyed<infer KT>
        ? ActualE extends Keyed<infer AKT>
          ? AKT extends KT
            ? true
            : false
          : ActualE extends "k"
            ? KT extends unknown
              ? true
              : false
            : false
        : InE extends "i"
          ? ActualE extends "i" | Indexed<any>
            ? true
            : false
          : InE extends "k"
            ? ActualE extends "k" | Keyed<any>
              ? true
              : false
            : InE extends ActualE
              ? true
              : false;

// In matches Actual: continued = prefix match, solid = exact match.
export type MatchesIn<In extends ShapeElem[], Actual extends ShapeElem[]> =
  IsContinued<In> extends true
    ? MatchesPrefix<Bare<In>, Actual> extends true
      ? Actual
      : never
    : MatchesExact<In, Actual> extends true
      ? Actual
      : never;

type MatchesPrefix<
  In extends ShapeElem[],
  Actual extends ShapeElem[],
> = In extends []
  ? true
  : In extends [
        infer InHead extends ShapeElem,
        ...infer InTail extends ShapeElem[],
      ]
    ? Actual extends [
        infer AHead extends ShapeElem,
        ...infer ATail extends ShapeElem[],
      ]
      ? ElemMatches<InHead, AHead> extends true
        ? MatchesPrefix<InTail, ATail>
        : false
      : false
    : false;

type MatchesExact<
  In extends ShapeElem[],
  Actual extends ShapeElem[],
> = In extends []
  ? Actual extends []
    ? true
    : false
  : In extends [
        infer InHead extends ShapeElem,
        ...infer InTail extends ShapeElem[],
      ]
    ? Actual extends [
        infer AHead extends ShapeElem,
        ...infer ATail extends ShapeElem[],
      ]
      ? ElemMatches<InHead, AHead> extends true
        ? MatchesExact<InTail, ATail>
        : false
      : false
    : false;

// Extract input type T when In matches Actual.
export type ExtractIn<In extends ShapeElem[], Actual extends ShapeElem[], T> =
  MatchesIn<In, Actual> extends Actual ? T : never;

export type Op<
  In extends ShapeElem[],
  Out extends ShapeElem[],
  T,
  R,
  Args extends any[] = [],
> = ((data: Pirell<In, T>, ...args: Args) => Pirell<Out, R>) & {
  // Optional: plain function is still a valid Op (no runtime check)
  readonly in?: In;
  readonly out?: Out;
};

// Named dim factories — call once at module level, not per data point.
// idim<T>() for indexed (T is the element type); kdim<T>() for keyed (T is value type).
// 'i'/'k' shorthands remain valid everywhere and carry no type information.
export function idim<T>(): Indexed<T> {
  return { __indexed: undefined } as unknown as Indexed<T>;
}
export function kdim<T>(): Keyed<T> {
  return { __keyed: undefined } as unknown as Keyed<T>;
}

// Attach In/Out at runtime so callers can check chain against shapes.
export function defineOp<
  In extends ShapeElem[],
  Out extends ShapeElem[],
  T,
  R,
  Args extends any[] = [],
>(spec: {
  in: In;
  out: Out;
  run: (data: Pirell<In, T>, ...args: Args) => Pirell<Out, R>;
}): Op<In, Out, T, R, Args> {
  const fn = ((data: Pirell<In, T>, ...args: Args) =>
    spec.run(data, ...args)) as Op<In, Out, T, R, Args>;
  (fn as { in: In; out: Out }).in = spec.in;
  (fn as { in: In; out: Out }).out = spec.out;
  return fn;
}

// Not `this`-typed: method closes over op at attach time,
// then narrows on each .extend() so pre-call shape no longer matches.
export type Fluent<F extends Op<any, any, any, any, any>> =
  F extends Op<any, infer Out, any, infer R, infer Args>
    ? (...args: Args) => Wrapper<Out, R>
    : never;

// Forward declaration to avoid circular dependency.
export interface Wrapper<S extends ShapeElem[], T> {
  shape: S;
  value: T;
}

export interface Deferred<
  In extends ShapeElem[],
  Out extends ShapeElem[],
  T,
  R,
> {
  (data: Pirell<In, T>): Pirell<Out, R>;
}

export type Entries<T> = { [K in keyof T]: [K, T[K]] }[keyof T];

export type Tuple<K, V> = readonly [K, V];

export type Merge<L, R> = Omit<L, keyof R> & R;

export type GroupResult<K extends PropertyKey, T> = { [P in K]: T[] };
