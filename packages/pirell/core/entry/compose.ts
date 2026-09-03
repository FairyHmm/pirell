import type { Op, Raw, Shape } from "../types/types.js";
import type { MatchesShape, ShapeOf, Check } from "../types/match.js";
import { makeFlat } from "../ops/ops.js";

// --- Shape gate for compose/pipe ---

// A zero-arg fn returning a fn is a curried Op-shaped link, matched by
// call shape alone — no nominal Op brand. Mirrors compose's own runtime
// check (`fn.length === 0 ? fn() : fn` below).
type IsThunk<F> = F extends () => (data: any) => any ? true : false;

// First link's In when it's a zero-arg Op-shaped thunk with a declared
// Op<FIn,...> type; otherwise ["..."] (uncheckable first link).
type FirstIn<Fns> = Fns extends [infer F, ...unknown[]]
  ? IsThunk<F> extends true
    ? F extends Op<infer FIn, any, infer FArgs>
      ? FArgs extends []
        ? FIn
        : ["..."]
      : ["..."]
    : ["..."]
  : never;

// Shared by compose's return and pipe's signature so the data gate can't
// drift between the two call sites.
type Gate<Fns, D> = D & Check<FirstIn<Fns>, D>;

// Shape a value carries at the current position (Raw<S> brand, else
// structural inference via ShapeOf). See PLAN.md re: assemble.ts's
// CurrentData, one layer above this, not a duplicate.
type ShapeOfCur<Cur> =
  Cur extends Raw<infer S extends Shape> ? S : ShapeOf<Cur> & Shape;

// F's output value type, or never on shape/link mismatch.
type Apply<Cur, F> =
  IsThunk<F> extends true
    ? F extends Op<infer FIn, infer FOut, infer FArgs>
      ? FArgs extends []
        ? MatchesShape<FIn, ShapeOfCur<Cur>> extends true
          ? Raw<FOut>
          : never
        : never
      : F extends () => (data: any) => infer R
        ? R
        : never
    : F extends (arg: Cur) => infer R
      ? R
      : never;

// Concretely typed links; exported for reuse by assemble.ts's fluent
// .pipe()/.compose().
export type Tail<Fns, Cur> = Fns extends [infer F, ...infer Rest]
  ? Apply<Cur, F> extends never
    ? never
    : Apply<Cur, F> extends infer R
      ? Rest extends []
        ? [(arg: Cur) => R]
        : [(arg: Cur) => R, ...Tail<Rest, R>]
      : never
  : [];

// WIP — see HANDOFF.md "ComposeChain collapses to never". The Op branch's
// tuple element is F itself (Op<FIn,FOut,[]>, still double-curried) to
// match what's actually passed positionally; something in this union
// still resolves to never downstream (assemble.ts/compose.test.ts break).
// Not landed as correct — left in place for the next session to pick up.
type ComposeChain<Fns> = Fns extends [infer F, ...infer Rest]
  ? IsThunk<F> extends true
    ? F extends Op<infer FIn, infer FOut, infer FArgs>
      ? FArgs extends []
        ? [Op<FIn, FOut, []>, ...Tail<Rest, Raw<FOut>>]
        : never
      : F extends () => (data: infer A) => infer R
        ? Rest extends []
          ? [() => (data: A) => R]
          : [() => (data: A) => R, ...Tail<Rest, R>]
        : never
    : F extends (arg: infer A) => infer R
      ? Rest extends []
        ? [(arg: A) => R]
        : [(arg: A) => R, ...Tail<Rest, R>]
      : never
  : never;

type ComposeResult<Fns> =
  ComposeChain<Fns> extends [...unknown[], infer Last]
    ? Last extends Op<any, infer LOut, any>
      ? Raw<LOut>
      : Last extends (arg: any) => infer R
        ? R
        : never
    : never;

// Returns a function — data is applied later, shape-gated at that call.
export function compose<Fns extends unknown[]>(
  ...fns: Fns & ComposeChain<Fns>
): <D>(data: Gate<Fns, D>) => ComposeResult<Fns>;
export function compose(...fns: Array<(x: any) => any>): (x: any) => any {
  // A zero-arg Op arrives curried — one extra call yields the (data) => R
  // stage; a bare fn is already that stage.
  const stages = fns.map((fn) => (fn.length === 0 ? (fn as () => any)() : fn));
  return (x: any) => stages.reduce((acc, fn) => fn(acc), x);
}

// Data-first view of compose. `compose as any` bridges compose's constrained
// rest param to makeFlat (pure `makeFlat(compose)` can't typecheck it — see
// the Flatten limitation in ops.ts); the asserted signature re-attaches the
// compile-time gate.
export const pipe = makeFlat(compose as any) as <D, Fns extends unknown[]>(
  data: Gate<Fns, D>,
  ...fns: Fns & ComposeChain<Fns>
) => ComposeResult<Fns>;
