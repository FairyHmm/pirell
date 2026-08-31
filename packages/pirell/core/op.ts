import type { Op, Shape } from "./types.js";

// Builds a fixed-arity dual-form Op (data-first or curried). Needed only
// when Args is non-empty — arity is impl.length - 1, so impl needs named
// params, not rest/default.
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
