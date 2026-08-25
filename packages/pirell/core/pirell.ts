import { Wrapper } from "./wrapper.js";
import { wireOps } from "./extend.js";
import type { Dim, Op, Pirell } from "./types.js";

// Pirell -> Pirell, same as Op, so it composes with pipe() and other
// ops interchangeably; extend() appends a step without running it.
export interface Deferred<In extends Dim[], Out extends Dim[], T, R> {
  (data: Pirell<In, T>): Pirell<Out, R>;
  extend<Ops extends Record<string, Op<any, any, any, any, any>>>(
    ops: Ops,
  ): Deferred<In, Out, T, R> & {
    [K in keyof Ops]: (...args: any[]) => Deferred<any, any, any, any>;
  };
}

type Step = (data: Pirell<any, any>) => Pirell<any, any>;

function runSteps(steps: Step[], data: Pirell<any, any>): Pirell<any, any> {
  return steps.length === 0
    ? data
    : steps.reduce((acc, step) => step(acc), data);
}

function makeDeferred<In extends Dim[], Out extends Dim[], T, R>(
  steps: Step[],
): Deferred<In, Out, T, R> {
  const run = ((data: Pirell<In, T>) =>
    runSteps(steps, data)) as unknown as Deferred<In, Out, T, R>;

  (run as any).extend = function <
    Ops extends Record<string, Op<any, any, any, any, any>>,
  >(ops: Ops) {
    wireOps(run, ops, (op, args) =>
      makeDeferred([...steps, (data: Pirell<any, any>) => op(data, ...args)]),
    );
    return run as any;
  };

  return run;
}

export function pirell<T>(data: T[]): Wrapper<["i"], T[]>;
export function pirell(): Deferred<[], [], undefined, undefined>;
export function pirell<T>(data?: T[]): unknown {
  if (arguments.length === 0) {
    return makeDeferred([]);
  }
  return new Wrapper(["i"], data);
}
