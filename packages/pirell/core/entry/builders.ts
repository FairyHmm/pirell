import { composeRaw } from "./compose.js";
import { SURFACE, isSurface, valueOf } from "./surface.js";
import type { Bound, Deferred, OpLike } from "../types/base.js";
import type { Assembled, OpMap } from "../types/assembled.js";

// Runtime surface builders (surface types live in types/assembled.ts).
// One shared assembly sequence; the two surface kinds differ only in
// what each step means (eager vs lazy).

// Ops are data fns; factories are applied to args first. A zero-arg call
// is ambiguous — data op or all-optional-arg factory. The result
// resolves it: factories, fed the data, produce the data-stage function.
const runOp = (op: OpLike, args: any[], data: unknown): unknown => {
  if (args.length === 0) {
    const direct = (op as (data: unknown) => unknown)(data);
    if (typeof direct === "function") {
      const stage = (op as (...a: any[]) => (d: unknown) => unknown)();
      if (typeof stage === "function") {
        return stage(data);
      }
    }
    return direct;
  }
  return (op as (...a: any[]) => (data: unknown) => unknown)(...args)(data);
};

type Method = (spec: SurfaceSpec, args: unknown[]) => unknown;

type SurfaceSpec = {
  invoke: (input: unknown) => unknown;
  getValue: () => unknown;
  applyOp: (op: OpLike, args: unknown[]) => unknown;
  spawn: (added: OpMap) => unknown;
};

// --- one universal loop ---

// One property map + single defineProperties: markers non-enumerable,
// methods enumerable+writable. Only `extend` is hardcoded — its table
// must exist before the first op registration.
function buildSurface(ops: OpMap, spec: SurfaceSpec): any {
  const target: any = spec.invoke;
  const methods: Record<string, Method> = {};
  methods.extend = (spec, [added]) => spec.spawn(added as OpMap);
  for (const name of Object.keys(ops)) {
    const op = ops[name]!;
    methods[name] = (spec, args) => spec.applyOp(op, args);
  }
  const assigned = {
    enumerable: true,
    writable: true,
    configurable: true,
  } as const;
  const props: PropertyDescriptorMap = {
    [SURFACE]: { value: true },
    value: { get: spec.getValue },
  };
  for (const [name, method] of Object.entries(methods)) {
    props[name] = {
      ...assigned,
      value: (...args: unknown[]) => method(spec, args),
    };
  }
  Object.defineProperties(target, props);
  return target;
}

export function buildBound(value: unknown, ops: OpMap): Assembled<Bound<any>> {
  return buildSurface(ops, {
    invoke: (input) => buildBound(valueOf(input), ops),
    getValue: () => value,
    applyOp: (op, args) => buildBound(runOp(op, args, value), ops),
    spawn: (added) => buildBound(value, { ...ops, ...added }),
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
    applyOp: (op, args) =>
      buildDeferred([...steps, (data) => runOp(op, args, data)], ops),
    spawn: (added) => buildDeferred(steps, { ...ops, ...added }),
  });
}
