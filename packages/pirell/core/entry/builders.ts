import {
  REGISTER,
  SURFACE,
  isRegistration,
  isSurface,
  valueOf,
} from "./surface.js";
import type { Bound, Deferred, OpLike } from "../types/base.js";
import type { Assembled, OpMap } from "../types/assembled.js";

// Runtime surface builders (surface types live in types/assembled.ts).
// One shared assembly sequence; Bound and Deferred differ only in what
// each step means (eager vs lazy).

// Zero-arg calls are ambiguous (data op vs all-optional-arg factory);
// the result resolves it. A Registration is returned as-is so applyOp
// can branch on it structurally.
const runOp = (op: OpLike, args: unknown[], data: unknown): unknown => {
  if (args.length === 0) {
    const direct = (op as (data: unknown) => unknown)(data);
    if (isRegistration(direct)) {
      return direct;
    }
    if (typeof direct === "function") {
      const stage = (op as (...a: unknown[]) => (d: unknown) => unknown)();
      if (typeof stage === "function") {
        return stage(data);
      }
    }
    return direct;
  }
  const result = (op as (...a: unknown[]) => (data: unknown) => unknown)(
    ...args,
  )(data);
  return result;
};

type SurfaceSpec = {
  invoke: (input: unknown) => unknown;
  getValue: () => unknown;
  applyOp: (op: OpLike, args: unknown[]) => unknown;
};

// --- one universal loop ---

// Proxy-based: a Registration can add methods mid-chain, so the table
// isn't fixed at build time. Typo-safety lives entirely on Fluent's
// compile-time coverage. No name is privileged — `ops: {}` yields zero
// methods, `extend` included (the free `extend(surface, ops)` function
// bootstraps a bare surface directly).
function buildSurface(ops: OpMap, spec: SurfaceSpec): any {
  const target: any = spec.invoke;
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
  const proxy = new Proxy(target, handler);
  return proxy;
}

// A Registration result grows the table instead of wrapping as data.
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
    // A Registration must grow the table before data arrives; ops can't
    // be speculatively run on fake data, so the REGISTER tag is checked
    // on the op itself, without invoking it.
    applyOp: (op, args) => {
      const result =
        typeof op === "function" && REGISTER in op
          ? runOp(op, args, undefined)
          : undefined;
      if (isRegistration(result)) {
        return buildDeferred(steps, { ...ops, ...result.ops });
      }
      return buildDeferred([...steps, (data) => runOp(op, args, data)], ops);
    },
  });
}
