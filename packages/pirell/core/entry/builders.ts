import {
  SURFACE,
  isRegistration,
  isRegisteringOp,
  isSurface,
  valueOf,
} from "./surface.js";
import type { Bound, Deferred, OpLike } from "../types/base.js";
import type { Assembled, OpMap } from "../types/assembled.js";

// Runtime surface builders (surface types live in types/assembled.ts).
// One shared assembly sequence; the two surface kinds differ only in
// what each step means (eager vs lazy).

// Ops are data fns; factories are applied to args first. A zero-arg call
// is ambiguous (data op vs all-optional-arg factory); the result resolves
// it — a factory, fed the data, yields the data-stage function. A
// Registration (extend's op body) is returned as-is; applyOp branches on
// it structurally, same category of check as the factory-result inspection.
const runOp = (op: OpLike, args: any[], data: unknown): unknown => {
  if (args.length === 0) {
    const direct = (op as (data: unknown) => unknown)(data);
    if (isRegistration(direct)) {
      return direct;
    }
    if (typeof direct === "function") {
      const stage = (op as (...a: any[]) => (d: unknown) => unknown)();
      if (typeof stage === "function") {
        return stage(data);
      }
    }
    return direct;
  }
  const result = (op as (...a: any[]) => (data: unknown) => unknown)(...args)(
    data,
  );
  return result;
};

type SurfaceSpec = {
  invoke: (input: unknown) => unknown;
  getValue: () => unknown;
  applyOp: (op: OpLike, args: unknown[]) => unknown;
};

// --- one universal loop ---

// Proxy-based resolution: a Registration can add methods mid-chain, so
// the method table isn't fixed at build time — a pre-listed descriptor
// map can't express that. Verified faster and smaller than eager
// Object.defineProperties at every table size (PLAN.md item 1).
// Typo-safety moves entirely onto Fluent's compile-time coverage —
// there is no runtime fallback for an unknown method name, by design.
//
// No name is privileged here — not even `extend`. A bare surface
// (`ops: {}`) has NO methods, extend included; the free
// `extend(surface, ops)` function (entry/extend.ts) is what grows it,
// reaching into buildBound/buildDeferred directly rather than
// requiring `.extend` to already exist. Every other surface gets
// `.extend` the ordinary way: because its ops-map author put it there.
function buildSurface(ops: OpMap, spec: SurfaceSpec): any {
  const target: any = spec.invoke;
  let proxy: any;
  const handler: ProxyHandler<any> = {
    get(t, prop, receiver) {
      if (prop === SURFACE) return true;
      if (prop === "value") return spec.getValue();
      if (typeof prop !== "string") return Reflect.get(t, prop, receiver);
      const op = ops[prop];
      if (op === undefined) return undefined;
      return (...args: unknown[]) => {
        const result = spec.applyOp(op, args);
        return result;
      };
    },
    has(t, prop) {
      if (prop === SURFACE || prop === "value") return true;
      return typeof prop === "string" && prop in ops;
    },
    apply(_t, _thisArg, args: unknown[]) {
      if (args.length === 0) return proxy;
      return spec.invoke(args[0]);
    },
  };
  proxy = new Proxy(target, handler);
  return proxy;
}

// applyOp runs the op and, if the result is a Registration, spawns a
// surface with the grown table instead of wrapping it as data — the
// one place extend's structural marker is actually consumed.
export function buildBound(value: unknown, ops: OpMap): Assembled<Bound<any>> {
  return buildSurface(ops, {
    invoke: (input) => buildBound(valueOf(input), ops),
    getValue: () => value,
    applyOp: (op, args) => {
      const result = runOp(op, args, value);
      return isRegistration(result)
        ? buildBound(value, { ...ops, ...result.ops })
        : buildBound(result, ops);
    },
  });
}

export function buildDeferred(
  steps: Array<(data: unknown) => unknown>,
  ops: OpMap,
): Assembled<Deferred<any>> {
  return buildSurface(ops, {
    invoke: (input) =>
      buildBound(
        isSurface(input)
          ? valueOf(input)
          : steps.reduce((acc, step) => step(acc), input),
        ops,
      ),
    getValue: () => undefined,
    // Registration must grow this Deferred's table before data arrives
    // (ops are known immediately), but a real op can't be speculatively
    // run on fake data (zero-arg calls are ambiguous, and ops may have
    // side effects). The op itself carries markRegistering's tag instead —
    // checked without invoking anything — so extend (extendOp) resolves
    // immediately and any future registering op gets the same for free;
    // nothing here names `extend` specifically.
    applyOp: (op, args) => {
      const result = isRegisteringOp(op)
        ? runOp(op, args, undefined)
        : undefined;
      if (isRegistration(result)) {
        return buildDeferred(steps, { ...ops, ...result.ops });
      }
      return buildDeferred([...steps, (data) => runOp(op, args, data)], ops);
    },
  });
}

// The standalone extend(surface, ops) free function (entry/extend.ts)
// must grow a surface's table even when it has no `.extend` method yet
// — only true for a genuinely bare `ops: {}` surface fresh off
// pirellRaw(), which by construction has zero accumulated Deferred
// steps (nothing could have been called on it; it has no methods).
// Anything with `.extend` already goes through the ordinary
// Registration path in applyOp above, which does preserve steps — this
// is bootstrap-only, not a general surface-growing primitive.
export function growBareSurface(surface: any, ops: OpMap): any {
  if (typeof surface.extend === "function") {
    throw new TypeError(
      "growBareSurface: surface already has .extend — use surface.extend(ops) instead.",
    );
  }
  return surface.value === undefined
    ? buildDeferred([], ops)
    : buildBound(surface.value, ops);
}
