// Recursively validates that each function's output matches the next
// function's input, and derives the pipeline's overall return type by
// walking the tuple to its last element. Unlimited arity
type ComposeFns<Fns extends unknown[], Acc> = Fns extends [
  (arg: Acc) => infer R,
  ...infer Rest,
]
  ? Rest extends []
    ? [(arg: Acc) => R]
    : [(arg: Acc) => R, ...ComposeFns<Rest, R>]
  : never;

type ComposeReturn<Fns extends unknown[]> = Fns extends [
  ...unknown[],
  (arg: any) => infer R,
]
  ? R
  : never;

// Deferred form: returns a plain function, applies nothing until called.
export function compose<
  A,
  Fns extends [(arg: A) => any, ...Array<(arg: any) => any>],
>(...fns: Fns & ComposeFns<Fns, A>): (a: A) => ComposeReturn<Fns>;
export function compose(...fns: Array<(x: any) => any>): (x: any) => any {
  return (x: any) => fns.reduce((acc, fn) => fn(acc), x);
}

// Immediate form: data-first, applies now instead of returning a func
export function pipe<
  A,
  Fns extends [(arg: A) => any, ...Array<(arg: any) => any>],
>(data: A, ...fns: Fns & ComposeFns<Fns, A>): ComposeReturn<Fns>;
export function pipe(data: any, ...fns: Array<(x: any) => any>): any {
  return (compose as (...fns: Array<(x: any) => any>) => (x: any) => any)(
    ...fns,
  )(data);
}
