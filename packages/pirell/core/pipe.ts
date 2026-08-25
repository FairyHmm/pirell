// Recursively validates that each function's output matches the next
// function's input, and derives the pipeline's overall return type by
// walking the tuple to its last element. Unlimited arity, unlike
// hand-written per-arity overloads.
type PipeFns<Fns extends unknown[], Acc> = Fns extends [
  (arg: Acc) => infer R,
  ...infer Rest,
]
  ? Rest extends []
    ? [(arg: Acc) => R]
    : [(arg: Acc) => R, ...PipeFns<Rest, R>]
  : never;

type PipeReturn<Fns extends unknown[]> = Fns extends [
  ...unknown[],
  (arg: any) => infer R,
]
  ? R
  : never;

export function pipe<
  A,
  Fns extends [(arg: A) => any, ...Array<(arg: any) => any>],
>(...fns: Fns & PipeFns<Fns, A>): (a: A) => PipeReturn<Fns>;
export function pipe(...fns: Array<(x: any) => any>): (x: any) => any {
  return (x: any) => fns.reduce((acc, fn) => fn(acc), x);
}
