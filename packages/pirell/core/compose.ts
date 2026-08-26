// Chain-validated typing for fluent .pipe()/.compose()
export type ComposeFns<Fns extends unknown[], Acc> = Fns extends [
  (arg: Acc) => infer R,
  ...infer Rest,
]
  ? Rest extends []
    ? [(arg: Acc) => R]
    : [(arg: Acc) => R, ...ComposeFns<Rest, R>]
  : never;

export type ComposeReturn<Fns extends unknown[]> = Fns extends [
  ...unknown[],
  (arg: any) => infer R,
]
  ? R
  : never;

// Returns a plain function, applies nothing until called.
export function compose<
  A,
  Fns extends [(arg: A) => any, ...Array<(arg: any) => any>],
>(...fns: Fns & ComposeFns<Fns, A>): (a: A) => ComposeReturn<Fns>;
export function compose(...fns: Array<(x: any) => any>): (x: any) => any {
  return (x: any) => fns.reduce((acc, fn) => fn(acc), x);
}

// Data-first: applies now instead of returning a func
export function pipe<
  A,
  Fns extends [(arg: A) => any, ...Array<(arg: any) => any>],
>(data: A, ...fns: Fns & ComposeFns<Fns, A>): ComposeReturn<Fns>;
export function pipe(data: any, ...fns: Array<(x: any) => any>): any {
  return (compose as (...fns: Array<(x: any) => any>) => (x: any) => any)(
    ...fns,
  )(data);
}
