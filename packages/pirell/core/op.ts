import type { Op, Shape } from "./types.js";

// Factory for a fixed-arity dual-form Op — needed only when Args is
// non-empty (Op collapses to a plain signature otherwise, see types.ts).
// Dispatches on arguments.length: arity args means curried (returns
// (data) => impl(...)), arity+1 means data-first (calls impl directly).
//
// Arity comes from impl.length - 1, not a separate parameter: impl's
// own declared param count is the one source of truth, so it can't
// disagree with Args. Caveat: impl needs named params, not rest/default
// (excluded from .length).
//
// In/Out are explicit type params since impl's `data` is untyped
// (Raw<In> erases to `unknown`) — nothing to infer a shape from. The
// cast at the end is what makes this necessary at all: a single
// function value can't structurally satisfy both the data-first and
// curried call signatures at once, so op() builds one function that
// behaves as both and asserts the type, backed by dispatched's real
// behavior.
export function op<
  In extends Shape,
  Out extends Shape,
  Args extends any[] = [],
>(impl: (data: unknown, ...args: Args) => unknown): Op<In, Out, Args> {
  const arity = impl.length - 1;
  const dispatched = (...callArgs: any[]) => {
    if (callArgs.length === arity) {
      return (data: any) => impl(data, ...(callArgs as Args));
    }
    const [data, ...rest] = callArgs;
    return impl(data, ...(rest as Args));
  };
  return dispatched as Op<In, Out, Args>;
}
