import { Wrapper, pirell as rawPirell } from "./pirell.js";
import { matchesInPrefix, chainableAt } from "./shape.js";
import type { Deferred, Dim, Fluent, Op, Pirell, MatchesIn } from "./types.js";
import { wireOps } from "./extend.js";
import { compose } from "./compose.js";
import type { ComposeFns, ComposeReturn } from "./compose.js";

// Single wiring point: primitives stay ignorant of each other.

type OpMap = Record<string, Op<any, any, any, any, any>>;

// Unified output type: Wrapper and Deferred both resolve to what the next op sees.
type CurrentData<S> =
  S extends Wrapper<infer Shp, infer T>
    ? Pirell<Shp, T>
    : S extends Deferred<any, infer Out, any, infer R>
      ? Pirell<Out, R>
      : never;

// Op's In must prefix-match current data shape
type InMatches<S, Op1 extends Op<any, any, any, any, any>> =
  Op1 extends Op<infer In, any, infer T, any, any>
    ? CurrentData<S> extends Pirell<infer Actual, T>
      ? MatchesIn<In, Actual> extends Actual
        ? true
        : false
      : false
    : false;

// Retypes the surface after an op to reflect the new output shape.
type Reassembled<S, Shp extends Dim[], T> =
  S extends Wrapper<any, any>
    ? Assembled<Wrapper<Shp, T>>
    : S extends Deferred<infer In, any, infer OrigT, any>
      ? Assembled<Deferred<In, Shp, OrigT, T>>
      : never;

// Shape-checked chain typing for .pipe()/.compose()
export type PipeChain<Fns extends unknown[], Acc> = Fns extends [
  (arg: Acc) => infer R,
  ...infer Rest,
]
  ? Acc extends Pirell<infer AShape extends Dim[], infer AT>
    ? Fns[0] extends Op<infer FIn, infer FOut, AT, infer FR, any>
      ? MatchesIn<FIn, AShape> extends AShape
        ? Rest extends []
          ? [(arg: Acc) => R]
          : [(arg: Acc) => R, ...PipeChain<Rest, Pirell<FOut, FR>>]
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
  extend<K extends string, Op1 extends Op<any, any, any, any, any>>(
    ops: InMatches<S, Op1> extends true
      ? Op1 extends Op<infer In, any, infer T, any, any>
        ? CurrentData<S> extends Pirell<In, T>
          ? Record<K, Op1>
          : never
        : never
      : never,
  ): Op1 extends Op<any, infer Out, any, infer R, any>
    ? Reassembled<S, Out, R> & { [P in K]: Fluent<Op1> }
    : never;
  extend<Ops extends OpMap>(
    ops: Ops & {
      [K in keyof Ops]: InMatches<S, Ops[K]> extends true ? Ops[K] : never;
    },
  ): Assembled<S> & {
    [K in keyof Ops]: Fluent<Ops[K] & Op<any, any, any, any, any>>;
  };
  pipe<Fns extends [(arg: S) => any, ...Array<(arg: any) => any>]>(
    ...fns: Fns & PipeChain<Fns, S> & ComposeFns<Fns, S>
  ): ComposeReturn<Fns>;
  compose<Fns extends [(arg: S) => any, ...Array<(arg: any) => any>]>(
    ...fns: Fns & PipeChain<Fns, S> & ComposeFns<Fns, S>
  ): ComposeReturn<Fns>;
};

// Build-time chain check: rejects pairs whose declared shapes disagree
function checkChainShapes(fns: Array<{ in?: Dim[]; out?: Dim[] }>): void {
  for (let i = 0; i < fns.length - 1; i++) {
    const prev = fns[i]!;
    const next = fns[i + 1]!;
    if (!chainableAt(prev.out, next)) {
      throw new TypeError(
        `pipe()/compose(): step ${i}'s declared Out (${JSON.stringify(prev.out)}) does not match step ${i + 1}'s declared In (${JSON.stringify(next.in)}).`,
      );
    }
  }
}

// Wire fluent methods onto a Wrapper
function assembleWrapper<S extends Dim[], T>(
  w: Wrapper<S, T>,
): Assembled<Wrapper<S, T>> {
  const asData = (): Pirell<S, T> => ({ shape: w.shape, value: w.value });

  (w as any).extend = function <Ops extends OpMap>(ops: Ops) {
    const next = assembleWrapper(new Wrapper(w.shape, w.value));
    wireOps(next, ops, (op, args) => {
      const data = asData();
      if (!matchesInPrefix(op, data.shape as Dim[])) {
        throw new TypeError(
          `extend(): op's declared In (${JSON.stringify((op as any).in)}) does not match the data's actual shape prefix.`,
        );
      }
      const result = op(data, ...args);
      return assembleWrapper(new Wrapper(result.shape, result.value));
    });
    return next;
  };

  (w as any).pipe = function (...fns: Array<(x: any) => any>) {
    checkChainShapes(fns as Array<{ in?: Dim[]; out?: Dim[] }>);
    const data = asData();
    const first = fns[0] as { in?: Dim[] } | undefined;
    if (first !== undefined && !matchesInPrefix(first, data.shape as Dim[])) {
      throw new TypeError(
        `pipe(): first step's declared In (${JSON.stringify(first.in)}) does not match the data's actual shape prefix.`,
      );
    }
    const result = compose(...(fns as [(x: any) => any]))(data);
    return assembleWrapper(new Wrapper(result.shape, result.value));
  };

  (w as any).compose = function (...fns: Array<(x: any) => any>) {
    checkChainShapes(fns as Array<{ in?: Dim[]; out?: Dim[] }>);
    const data = asData();
    const first = fns[0] as { in?: Dim[] } | undefined;
    if (first !== undefined && !matchesInPrefix(first, data.shape as Dim[])) {
      throw new TypeError(
        `compose(): first step's declared In (${JSON.stringify(first.in)}) does not match the data's actual shape prefix.`,
      );
    }
    const result = (compose(...(fns as [(x: any) => any])) as (x: any) => any)(
      data,
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
        (data: Pirell<any, any>) => {
          if (!matchesInPrefix(op, data.shape as Dim[])) {
            throw new TypeError(
              `extend(): op's declared In (${JSON.stringify((op as any).in)}) does not match the data's actual shape prefix.`,
            );
          }
          return op(data, ...args);
        },
      ]),
    );
    return next;
  };

  (run as any).pipe = function (...fns: Array<(x: any) => any>) {
    checkChainShapes(fns as Array<{ in?: Dim[]; out?: Dim[] }>);
    return assembleDeferred([...steps, ...fns]);
  };

  (run as any).compose = function (...fns: Array<(x: any) => any>) {
    checkChainShapes(fns as Array<{ in?: Dim[]; out?: Dim[] }>);
    return assembleDeferred([
      ...steps,
      (compose as (...fns: Array<(x: any) => any>) => (x: any) => any)(...fns),
    ]);
  };

  return run as any;
}

// pirell(data) → Wrapper; pirell() → Deferred
export function pirell<T>(data: T): Assembled<Wrapper<Dim[], T>>;
export function pirell(): Assembled<Deferred<[], [], undefined, undefined>>;
export function pirell<T>(data?: T): unknown {
  if (arguments.length === 0) {
    return assembleDeferred([]);
  }
  const w = rawPirell(data as T);
  return assembleWrapper(w);
}
