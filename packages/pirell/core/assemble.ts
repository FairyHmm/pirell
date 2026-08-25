import { Wrapper, pirell as rawPirell } from "./pirell.js";
import type { Deferred, Dim, Fluent, Op, Pirell } from "./types.js";
import { wireOps } from "./extend.js";
import { compose } from "./compose.js";

// Assembly layer: the only place that composes the bare primitives
// (Wrapper, Deferred, wireOps, compose) into the public pirell surface.
// Primitives stay ignorant of each other; this file owns all wiring.

type OpMap = Record<string, Op<any, any, any, any, any>>;

// .extend(ops), .pipe(...fns), and .compose(...fns) are always present
type Assembled<S> = S & {
  extend<Ops extends OpMap>(
    ops: Ops,
  ): Assembled<S> & {
    [K in keyof Ops]: Fluent<Ops[K] & Op<any, any, any, any, any>>;
  };
  pipe(...fns: Array<(x: any) => any>): any;
  compose(...fns: Array<(x: any) => any>): any;
};

// Wire .extend(), .pipe(), and .compose() onto a Wrapper
function assembleWrapper<S extends Dim[], T>(
  w: Wrapper<S, T>,
): Assembled<Wrapper<S, T>> {
  const asData = (): Pirell<S, T> => ({ shape: w.shape, value: w.value });

  (w as any).extend = function <Ops extends OpMap>(ops: Ops) {
    wireOps(w, ops, (op, args) => {
      const result = op(asData(), ...args);
      return assembleWrapper(new Wrapper(result.shape, result.value));
    });
    return w;
  };

  (w as any).pipe = function (...fns: Array<(x: any) => any>) {
    const result = compose(...(fns as [(x: any) => any]))(asData());
    return assembleWrapper(new Wrapper(result.shape, result.value));
  };

  (w as any).compose = function (...fns: Array<(x: any) => any>) {
    const result = (compose(...(fns as [(x: any) => any])) as (x: any) => any)(
      asData(),
    );
    return assembleWrapper(new Wrapper(result.shape, result.value));
  };

  return w as any;
}

// Build a Deferred from an accumulated step list and wire .extend()/.pipe()/.compose()
function assembleDeferred(
  steps: Array<(data: Pirell<any, any>) => Pirell<any, any>>,
): Assembled<Deferred<any, any, any, any>> {
  const run = ((data: Pirell<any, any>) =>
    steps.reduce((acc, step) => step(acc), data)) as Deferred<
    any,
    any,
    any,
    any
  >;

  (run as any).extend = function <Ops extends OpMap>(ops: Ops) {
    wireOps(run, ops, (op, args) =>
      assembleDeferred([
        ...steps,
        (data: Pirell<any, any>) => op(data, ...args),
      ]),
    );
    return run;
  };

  (run as any).pipe = function (...fns: Array<(x: any) => any>) {
    return assembleDeferred([...steps, ...fns]);
  };

  (run as any).compose = function (...fns: Array<(x: any) => any>) {
    return assembleDeferred([
      ...steps,
      (compose as (...fns: Array<(x: any) => any>) => (x: any) => any)(...fns),
    ]);
  };

  return run as any;
}

// Public entry: pirell(data) → assembled Wrapper; pirell() → assembled Deferred
export function pirell<T>(data: T[]): Assembled<Wrapper<["i"], T[]>>;
export function pirell(): Assembled<Deferred<[], [], undefined, undefined>>;
export function pirell<T>(data?: T[]): unknown {
  if (arguments.length === 0) {
    return assembleDeferred([]);
  }
  const w = rawPirell(data as T[]);
  return assembleWrapper(w);
}
