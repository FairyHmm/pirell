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

export type Fluent<F extends Op<any, any, any, any, any>> =
  F extends Op<infer In, infer Out, infer T, infer R, infer Args>
    ? (this: Wrapper<In, T>, ...args: Args) => Wrapper<Out, R>
    : never;

// Interface, not the class import, to avoid a circular dependency with
// core/wrapper.ts (implementation lands in Phase 2).
export interface Wrapper<S extends Dim[], T> {
  shape: S;
  value: T;
}

export type Entries<T> = { [K in keyof T]: [K, T[K]] }[keyof T];

export type Tuple<K, V> = readonly [K, V];

export type Merge<L, R> = Omit<L, keyof R> & R;

export type GroupResult<K extends PropertyKey, T> = { [P in K]: T[] };
