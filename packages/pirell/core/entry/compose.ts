import type { Op, Raw, Shape } from "../types/types.js";
import type { MatchesShape, ShapeOf, Check } from "../types/match.js";
import { makeFlat } from "../ops/ops.js";

// --- Shape gate for compose/pipe ---

// First link's In when it's a zero-arg Op; otherwise ["..."] — an
// uncheckable first link (plain fn or parameterized op) must not gate D.
type FirstIn<Fns> = Fns extends [infer F, ...unknown[]]
  ? F extends Op<infer FIn, any, infer FArgs>
    ? FArgs extends []
      ? FIn
      : ["..."]
    : ["..."]
  : never;

// Shared by compose's return and pipe's signature so the data gate can't
// drift between the two call sites.
type Gate<Fns, D> = D & Check<FirstIn<Fns>, D>;

// Shape a value carries at the current position (Raw<S> phantom, else structural).
type ShapeOfCur<Cur> =
  Cur extends Raw<infer S extends Shape> ? S : ShapeOf<Cur> & Shape;

// F's output value type, or never on shape/link mismatch. Zero-arg Ops
// auto-invoke as chain links; a parameterized Op (Args non-empty) rejects
// so its required argument can't be silently dropped.
type Apply<Cur, F> =
  F extends Op<infer FIn, infer FOut, infer FArgs>
    ? FArgs extends []
      ? MatchesShape<FIn, ShapeOfCur<Cur>> extends true
        ? Raw<FOut>
        : never
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

// Compose's first link input comes from its own signature, not from data, so
// it isn't shape-gated here. Zero-arg Op auto-invokes, same as Apply.
type ComposeChain<Fns> = Fns extends [infer F, ...infer Rest]
  ? F extends Op<infer FIn, infer FOut, infer FArgs>
    ? FArgs extends []
      ? [(arg: Raw<FIn>) => Raw<FOut>, ...Tail<Rest, Raw<FOut>>]
      : never
    : F extends (arg: infer A) => infer R
      ? Rest extends []
        ? [(arg: A) => R]
        : [(arg: A) => R, ...Tail<Rest, R>]
      : never
  : never;

type ComposeResult<Fns> =
  ComposeChain<Fns> extends [...unknown[], (arg: any) => infer R] ? R : never;

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
