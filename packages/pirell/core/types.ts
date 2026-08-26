export type Dim = "i" | "k" | "t";

export type Pirell<S extends Dim[], T> = {
  shape: S;
  value: T;
};

export type Op<
  In extends Dim[],
  Out extends Dim[],
  T,
  R,
  Args extends any[] = [],
> = (data: Pirell<In, T>, ...args: Args) => Pirell<Out, R>;

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
