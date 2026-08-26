import { Wrapper, pirell as rawPirell } from "./pirell.js";
import type { Deferred, Dim, Fluent, Op, Pirell } from "./types.js";
import { wireOps } from "./extend.js";
import { compose } from "./compose.js";
import type { ComposeFns, ComposeReturn } from "./compose.js";

// Single wiring point: primitives stay ignorant of each other.

type OpMap = Record<string, Op<any, any, any, any, any>>;

// Unified output type: Wrapper and Deferred both resolve to what the next op sees.
type CurrentData<S> = S extends Wrapper<infer Shp, infer T>
  ? Pirell<Shp, T>
  : S extends Deferred<any, infer Out, any, infer R>
    ? Pirell<Out, R>
    : never;

// Retypes the surface after an op to reflect the new output shape.
type Reassembled<S, Shp extends Dim[], T> = S extends Wrapper<any, any>
  ? Assembled<Wrapper<Shp, T>>
  : S extends Deferred<infer In, any, infer OrigT, any>
    ? Assembled<Deferred<In, Shp, OrigT, T>>
    : never;

// Reuse compose.ts's chain-checking for fluent .pipe()/.compose()
// instead of erasing to untyped arrays.
type Assembled<S> = S & {
  extend<K extends string, Op1 extends Op<any, any, any, any, any>>(
    ops: Op1 extends Op<infer In, any, infer T, any, any>
      ? CurrentData<S> extends Pirell<In, T>
        ? Record<K, Op1>
        : never
      : never,
  ): Op1 extends Op<any, infer Out, any, infer R, any>
    ? Reassembled<S, Out, R> & { [P in K]: Fluent<Op1> }
    : never;
  extend<Ops extends OpMap>(
    ops: Ops & {
      [K in keyof Ops]: Ops[K] extends Op<infer In, any, infer T, any, any>
        ? CurrentData<S> extends Pirell<In, T>
          ? Ops[K]
          : never
        : never;
    },
  ): Assembled<S> & {
    [K in keyof Ops]: Fluent<Ops[K] & Op<any, any, any, any, any>>;
  };
  pipe<Fns extends [(arg: S) => any, ...Array<(arg: any) => any>]>(
    ...fns: Fns & ComposeFns<Fns, S>
  ): ComposeReturn<Fns>;
  compose<Fns extends [(arg: S) => any, ...Array<(arg: any) => any>]>(
    ...fns: Fns & ComposeFns<Fns, S>
  ): ComposeReturn<Fns>;
};

// Wire fluent methods onto a Wrapper
function assembleWrapper<S extends Dim[], T>(
  w: Wrapper<S, T>,
): Assembled<Wrapper<S, T>> {
  const asData = (): Pirell<S, T> => ({ shape: w.shape, value: w.value });

  (w as any).extend = function <Ops extends OpMap>(ops: Ops) {
    const next = assembleWrapper(new Wrapper(w.shape, w.value));
    wireOps(next, ops, (op, args) => {
      const result = op(asData(), ...args);
      return assembleWrapper(new Wrapper(result.shape, result.value));
    });
    return next;
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

// Build a Deferred and wire fluent methods
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
    const next = assembleDeferred([...steps]);
    wireOps(next, ops, (op, args) =>
      assembleDeferred([
        ...steps,
        (data: Pirell<any, any>) => op(data, ...args),
      ]),
    );
    return next;
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

// pirell(data) → Wrapper; pirell() → Deferred
export function pirell<T>(data: T[]): Assembled<Wrapper<["i"], T[]>>;
export function pirell(): Assembled<Deferred<[], [], undefined, undefined>>;
export function pirell<T>(data?: T[]): unknown {
  if (arguments.length === 0) {
    return assembleDeferred([]);
  }
  const w = rawPirell(data as T[]);
  return assembleWrapper(w);
}
