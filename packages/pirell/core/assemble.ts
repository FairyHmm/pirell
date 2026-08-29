import { Wrapper, pirell as rawPirell } from "./pirell.js";
import type { Deferred, Dim, Fluent, Op, Pirell, Shape } from "./types.js";
import type { MatchesIn } from "./match.js";
import { wireOps } from "./extend.js";
import { compose } from "./compose.js";
import type { ComposeFns, ComposeReturn } from "./compose.js";

// Single wiring point: primitives stay ignorant of each other.

type OpMap = Record<string, Op<any, any, any>>;

// Unified output type: Wrapper and Deferred both resolve to what the next op sees.
type CurrentData<S> =
  S extends Wrapper<infer Shp extends Shape>
    ? Pirell<Shp>
    : S extends Deferred<any, infer Out extends Shape>
      ? Pirell<Out>
      : never;

// Retypes the surface after an op to reflect the new output shape.
type Reassembled<S, Shp extends Shape> =
  S extends Wrapper<any>
    ? Assembled<Wrapper<Shp>>
    : S extends Deferred<infer In, any>
      ? Assembled<Deferred<In, Shp>>
      : never;

// Shape-checked chain typing for .pipe()/.compose()
export type PipeChain<Fns extends unknown[], Acc> = Fns extends [
  (arg: Acc) => infer R,
  ...infer Rest,
]
  ? Acc extends Pirell<infer AShape extends Shape>
    ? Fns[0] extends Op<infer FIn, infer FOut, any>
      ? MatchesIn<FIn, AShape> extends AShape
        ? Rest extends []
          ? [(arg: Acc) => R]
          : [(arg: Acc) => R, ...PipeChain<Rest, Pirell<FOut>>]
        : never
      : Rest extends []
        ? [(arg: Acc) => R]
        : [(arg: Acc) => R, ...PipeChain<Rest, R>]
    : Rest extends []
      ? [(arg: Acc) => R]
      : [(arg: Acc) => R, ...PipeChain<Rest, R>]
  : never;

// Reuse compose.ts's chain-checking for fluent .pipe()/.compose()
// instead of erasing to untyped arrays.
type Assembled<S> = S & {
  extend<K extends string, Op1 extends Op<any, any, any>>(
    ops: Op1 extends Op<infer In, any, any>
      ? CurrentData<S> extends Pirell<infer Actual extends Shape>
        ? MatchesIn<In, Actual> extends Actual
          ? Record<K, Op1>
          : never
        : never
      : never,
  ): Op1 extends Op<any, infer Out, any>
    ? Reassembled<S, Out> & { [P in K]: Fluent<Op1> }
    : never;
  extend<Ops extends OpMap>(
    ops: Ops & {
      [K in keyof Ops]: Ops[K] extends Op<infer In, any, any>
        ? CurrentData<S> extends Pirell<infer Actual extends Shape>
          ? MatchesIn<In, Actual> extends Actual
            ? Ops[K]
            : never
          : never
        : never;
    },
  ): Assembled<S> & {
    [K in keyof Ops]: Fluent<Ops[K] & Op<any, any, any>>;
  };
  pipe<Fns extends [(arg: S) => any, ...Array<(arg: any) => any>]>(
    ...fns: Fns & PipeChain<Fns, S> & ComposeFns<Fns, S>
  ): ComposeReturn<Fns>;
  compose<Fns extends [(arg: S) => any, ...Array<(arg: any) => any>]>(
    ...fns: Fns & PipeChain<Fns, S> & ComposeFns<Fns, S>
  ): ComposeReturn<Fns>;
};

// Wire fluent methods onto a Wrapper. Shape checking is compile-time only
// (MatchesIn/PipeChain above) — no runtime shape to read or throw against.
function assembleWrapper<S extends Shape>(
  w: Wrapper<S>,
): Assembled<Wrapper<S>> {
  const asData = (): Pirell<S> => ({ value: w.value });

  (w as any).extend = function <Ops extends OpMap>(ops: Ops) {
    const next = assembleWrapper(new Wrapper<S>(w.value));
    wireOps(next, ops, (op, args) => {
      const data = asData();
      const result = op(data, ...args);
      return assembleWrapper(new Wrapper(result.value));
    });
    return next;
  };

  (w as any).pipe = function (...fns: Array<(x: any) => any>) {
    const data = asData();
    const result = compose(...(fns as [(x: any) => any]))(data);
    return assembleWrapper(new Wrapper(result.value));
  };

  (w as any).compose = function (...fns: Array<(x: any) => any>) {
    const data = asData();
    const result = (compose(...(fns as [(x: any) => any])) as (x: any) => any)(
      data,
    );
    return assembleWrapper(new Wrapper(result.value));
  };

  return w as any;
}

// Build a Deferred and wire fluent methods
function assembleDeferred(
  steps: Array<(data: Pirell<any>) => Pirell<any>>,
): Assembled<Deferred<any, any>> {
  const run = ((data: Pirell<any>) =>
    steps.reduce((acc, step) => step(acc), data)) as Deferred<any, any>;

  (run as any).extend = function <Ops extends OpMap>(ops: Ops) {
    const next = assembleDeferred([...steps]);
    wireOps(next, ops, (op, args) =>
      assembleDeferred([...steps, (data: Pirell<any>) => op(data, ...args)]),
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
export function pirell(data: unknown): Assembled<Wrapper<Dim[]>>;
export function pirell(): Assembled<Deferred<[], []>>;
export function pirell(...args: [unknown] | []): unknown {
  if (args.length === 0) {
    return assembleDeferred([]);
  }
  const w = rawPirell(args[0]);
  return assembleWrapper(w);
}
