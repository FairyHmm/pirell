import type { Op, Shape } from "./base.js";
import type { IsThunk, IsTuple, Tail, ThreadResult } from "./stages.js";

// --- Shape gate for compose/pipe ---

// First link's own data param, no DataOf re-derivation. Give-ups match
// ComposeChain's.
export type FirstData<Fns extends readonly unknown[]> = Fns extends [
  infer F,
  ...unknown[],
]
  ? IsThunk<F> extends true
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any -- thunk factories take optional args; unknown[] rest would reject single-param data-returning factories
      F extends (...args: any[]) => (data: infer D0) => unknown
      ? D0
      : unknown
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Op's second param is Shape-constrained; any is the only permissive filler, it's deliberately unread
      F extends Op<infer _FIn extends Shape, any>
      ? F extends (data: infer D0) => unknown
        ? D0
        : unknown
      : unknown
  : IsTuple<Fns> extends true
    ? never
    : unknown;

// First link stays double-curried (passed un-invoked, declared Op type
// intact); later links are threaded. Links keep their own declared
// types — no Op/Raw reconstruction (see Step).
export type ComposeChain<Fns extends readonly unknown[]> =
  IsTuple<Fns> extends true
    ? Fns extends [infer F, ...infer Rest]
      ? IsThunk<F> extends true
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any -- thunk's data fn is matched bare (data never read, only R); arg-any accepts every factory
          F extends (...args: any[]) => (data: any) => infer R
          ? [F, ...Tail<Rest, R>]
          : never
        : F extends (arg: infer _A) => infer R
          ? Rest extends []
            ? [F]
            : [F, ...Tail<Rest, R>]
          : never
      : never
    : Fns extends Array<infer F>
      ? F extends (arg: infer A) => infer R
        ? Array<(arg: A) => R>
        : Array<F>
      : never;

// compose's name for the generic thread-result fold.
export type ComposeResult<Fns extends readonly unknown[]> = ThreadResult<Fns>;
