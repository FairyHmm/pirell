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

// wireOps only registers ops under a name; shape-checking already
// happens at the Op call signature and in assemble.ts's chain typing.
export function wireOps<Ops extends Record<string, Op<any, any, any>>>(
  target: any,
  ops: Ops,
  apply: (op: Op<any, any, any>, args: any[]) => unknown,
): void {
  for (const name of Object.keys(ops)) {
    const opFn = ops[name]!;
    target[name] = (...args: any[]) => apply(opFn, args);
  }
}

// Two calling conventions: extend(surface, ops) or extend(ops)(surface)
export function extend<Ops extends Record<string, Op<any, any, any>>>(
  surface: any,
  ops: Ops,
): any;
export function extend<Ops extends Record<string, Op<any, any, any>>>(
  ops: Ops,
): (surface: any) => any;
export function extend(fn: Op<any, any, any>): (x: any) => any;
export function extend(surfaceOrOps: any, ops?: any): any {
  if (ops !== undefined) {
    return applyExtend(surfaceOrOps, ops);
  }
  if (typeof surfaceOrOps === "function") {
    // Unwraps a surface to its raw value before calling fn — a bare
    // value passes through unchanged. Surfaces are callable (functions),
    // so the object/function typeof check both matter here.
    return (surfaceOrValue: any) => {
      const raw =
        surfaceOrValue != null &&
        (typeof surfaceOrValue === "object" ||
          typeof surfaceOrValue === "function") &&
        "value" in surfaceOrValue
          ? surfaceOrValue.value
          : surfaceOrValue;
      return surfaceOrOps(raw);
    };
  }
  return (surface: any) => applyExtend(surface, surfaceOrOps);
}

function applyExtend(
  surface: any,
  ops: Record<string, Op<any, any, any>>,
): any {
  if (typeof surface.extend !== "function") {
    throw new TypeError(
      "extend(surface, ops): surface has no .extend() method — pass an assembled pirell() surface.",
    );
  }
  return surface.extend(ops);
}
