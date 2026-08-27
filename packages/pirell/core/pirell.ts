import type { Deferred, Dim, Pirell, ShapeElem } from "./types.js";
import { makeLazyShapeProxy } from "./shape.js";

// Bare data-bound surface: shape + value only
export class Wrapper<S extends ShapeElem[], T> {
  public readonly shape: S;

  constructor(
    shape: S,
    public readonly value: T,
  ) {
    this.shape = shape;
  }
}

type Step = (data: Pirell<any, any>) => Pirell<any, any>;

function runSteps(steps: Step[], data: Pirell<any, any>): Pirell<any, any> {
  return steps.length === 0
    ? data
    : steps.reduce((acc, step) => step(acc), data);
}

function makeDeferred<In extends ShapeElem[], Out extends ShapeElem[], T, R>(
  steps: Step[],
): Deferred<In, Out, T, R> {
  return ((data: Pirell<In, T>) =>
    runSteps(steps, data)) as unknown as Deferred<In, Out, T, R>;
}

export function pirell(): Deferred<[], [], undefined, undefined>;
export function pirell<T>(data: T): Wrapper<Dim[], T>;
export function pirell<T>(data?: T): unknown {
  if (arguments.length === 0) {
    return makeDeferred([]);
  }
  // pirell(undefined) is distinct from pirell() — throw explicitly
  if (data === undefined) {
    throw new TypeError(
      "pirell(undefined) is not valid — call pirell() for a deferred builder, or pass a JSON value.",
    );
  }
  const shape = makeLazyShapeProxy(data);
  return new Wrapper(shape, data);
}
