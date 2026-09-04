import { compose } from "./compose.js";
import { SURFACE, isSurface, valueOf } from "./surface.js";
import type { Bound, Deferred, Op } from "../types/base.js";
import type { Assembled, OpMap } from "./assemble.js";

// Runtime surface builders (companion to assemble.ts, which owns the
// surface types). One shared assembly sequence; the two surface kinds
// differ only in what each step means (eager vs lazy).

const runSteps = (
  steps: Array<(data: unknown) => unknown>,
  data: unknown,
): unknown => steps.reduce((acc, step) => step(acc), data);

// Ops are uniformly curried: apply args now, data when it arrives.
const runOp = (op: Op<any, any, any>, args: any[], data: unknown): unknown =>
  (op as unknown as (...a: any[]) => (data: unknown) => unknown)(...args)(data);

// One untyped bridge over compose, shared by the pipe/compose call sites.
const asComposed = (fns: Array<(x: any) => any>): ((x: any) => any) =>
  (compose as (...fns: Array<(x: any) => any>) => (x: any) => any)(...fns);

// Registers ops by name only; shape-checking lives at the Op signature
// and in assemble.ts's chain typing. The fluent method forwards whatever
// args the call site gives it.
function wireOps<Ops extends Record<string, Op<any, any, any>>>(
  target: any,
  ops: Ops,
  apply: (op: Op<any, any, any>, args: any[]) => unknown,
): void {
  for (const name of Object.keys(ops)) {
    const opFn = ops[name]!;
    target[name] = (...args: any[]) => apply(opFn, args);
  }
}

function attachBase(target: object, getValue: () => unknown): void {
  Object.defineProperty(target, SURFACE, { value: true });
  Object.defineProperty(target, "value", { get: getValue });
}

function attachExtend(
  target: any,
  ops: OpMap,
  spawn: (ops: OpMap) => unknown,
): void {
  target.extend = function (added: OpMap) {
    return spawn({ ...ops, ...added });
  };
}

type SurfaceSpec = {
  invoke: (input: unknown) => unknown;
  getValue: () => unknown;
  applyOp: (op: Op<any, any, any>, args: any[]) => unknown;
  spawn: (ops: OpMap) => unknown;
  onPipe: (fns: Array<(x: any) => any>) => unknown;
  composable: boolean;
};

function buildSurface(ops: OpMap, spec: SurfaceSpec): any {
  const target: any = spec.invoke;
  attachBase(target, spec.getValue);
  wireOps(target, ops, spec.applyOp);
  attachExtend(target, ops, spec.spawn);
  const onPipe = (...fns: Array<(x: any) => any>) => spec.onPipe(fns);
  target.pipe = onPipe;
  // compose() only where composition can stay lazy; a bound surface has
  // nothing deferred to compose into (see Assembled<S> in assemble.ts).
  if (spec.composable) target.compose = onPipe;
  return target;
}

// Data-bound surface. `value` is the current raw JSON result.
export function buildBound(
  value: unknown,
  ops: OpMap,
): Assembled<Bound<any>> {
  return buildSurface(ops, {
    // Re-enter: reuse another surface's value, or bind raw data as-is.
    invoke: (input) => buildBound(valueOf(input), ops),
    getValue: () => value,
    applyOp: (op, args) => buildBound(runOp(op, args, value), ops),
    spawn: (nextOps) => buildBound(value, nextOps),
    onPipe: (fns) => asComposed(fns)(value),
    composable: false,
  });
}

// Lazy builder surface. `steps` accumulate until data is supplied.
export function buildDeferred(
  steps: Array<(data: unknown) => unknown>,
  ops: OpMap,
): Assembled<Deferred<any>> {
  // pipe and compose are the same append: staying lazy already is
  // compose's "don't apply yet" contract.
  const append = (fns: Array<(x: any) => any>) =>
    buildDeferred([...steps, asComposed(fns)], ops);
  return buildSurface(ops, {
    invoke: (input) =>
      buildBound(
        isSurface(input) ? valueOf(input) : runSteps(steps, input),
        ops,
      ),
    getValue: () => undefined,
    applyOp: (op, args) =>
      buildDeferred([...steps, (data) => runOp(op, args, data)], ops),
    spawn: (nextOps) => buildDeferred(steps, nextOps),
    onPipe: append,
    composable: true,
  });
}
