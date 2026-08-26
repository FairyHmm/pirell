export type Dim = "i" | "k";

export type Pirell<S extends Dim[], T> = {
  shape: S;
  value: T;
};

// Bound shape: prefix is asserted, remainder is wildcard
export type Continued<S extends Dim[]> = S & { readonly __continued: true };

// Mixed dim: children are non-uniform, no single wrapped stack describes them
export type Mixed<D extends Dim, Variants extends Dim[] = Dim[]> = {
  readonly __mixed: D;
  readonly __variants: Variants;
};

// Check brand directly: `S extends Continued<any>` always resolves to true
export type IsContinued<S extends Dim[]> = S extends {
  readonly __continued: true;
}
  ? true
  : false;

// Strips the Continued brand back down to a plain Dim[] for structural checks.
type Bare<S extends Dim[]> = S extends Continued<infer B> ? B : S;

// In matches Actual: continued = prefix match, solid = exact match
export type MatchesIn<In extends Dim[], Actual extends Dim[]> =
  IsContinued<In> extends true
    ? MatchesPrefix<Bare<In>, Actual> extends true
      ? Actual
      : never
    : MatchesExact<In, Actual> extends true
      ? Actual
      : never;

type MatchesPrefix<In extends Dim[], Actual extends Dim[]> = In extends []
  ? true
  : Actual extends [In[0], ...infer RestActual extends Dim[]]
    ? In extends [any, ...infer InTail extends Dim[]]
      ? MatchesPrefix<InTail, RestActual>
      : false
    : false;

type MatchesExact<In extends Dim[], Actual extends Dim[]> = In extends []
  ? Actual extends []
    ? true
    : false
  : Actual extends [In[0], ...infer RestActual extends Dim[]]
    ? In extends [any, ...infer InTail extends Dim[]]
      ? MatchesExact<InTail, RestActual>
      : false
    : false;

// Extract input type T when In matches Actual
export type ExtractIn<In extends Dim[], Actual extends Dim[], T> =
  MatchesIn<In, Actual> extends Actual ? T : never;

export type Op<
  In extends Dim[],
  Out extends Dim[],
  T,
  R,
  Args extends any[] = [],
> = ((data: Pirell<In, T>, ...args: Args) => Pirell<Out, R>) & {
  // Optional: plain function is still a valid Op (no runtime check)
  readonly in?: In;
  readonly out?: Out;
};

// Attach In/Out at runtime so callers can check chain against shapes
export function defineOp<
  In extends Dim[],
  Out extends Dim[],
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
export interface Wrapper<S extends Dim[], T> {
  shape: S;
  value: T;
}

export interface Deferred<In extends Dim[], Out extends Dim[], T, R> {
  (data: Pirell<In, T>): Pirell<Out, R>;
}

export type Entries<T> = { [K in keyof T]: [K, T[K]] }[keyof T];

export type Tuple<K, V> = readonly [K, V];

export type Merge<L, R> = Omit<L, keyof R> & R;

export type GroupResult<K extends PropertyKey, T> = { [P in K]: T[] };
