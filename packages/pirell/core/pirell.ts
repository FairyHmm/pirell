import { Wrapper } from "./wrapper.js";
import type { Dim, Pirell } from "./types.js";

// Bare identity callable — no .extend(), no .pipe(). Assembly layer adds those.
export interface Deferred<In extends Dim[], Out extends Dim[], T, R> {
  (data: Pirell<In, T>): Pirell<Out, R>;
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
  return ((data: Pirell<In, T>) =>
    runSteps(steps, data)) as unknown as Deferred<In, Out, T, R>;
}

export function pirell<T>(data: T[]): Wrapper<["i"], T[]>;
export function pirell(): Deferred<[], [], undefined, undefined>;
export function pirell<T>(data?: T[]): unknown {
  if (arguments.length === 0) {
    return makeDeferred([]);
  }
  return new Wrapper(["i"], data);
}
