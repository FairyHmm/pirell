import { pirell as rawPirell } from "./pirell.js";
import type {
  Bound,
  Deferred,
  Dim,
  Fluent,
  Op,
  Raw,
  Shape,
} from "./types.js";
import type { MatchesIn } from "./match.js";
import { wireOps } from "./extend.js";
import { compose, type Tail } from "./compose.js";

// Single wiring point: primitives stay ignorant of each other.

type OpMap = Record<string, Op<any, any, any>>;

// Unified output type: Bound and Deferred both resolve to what the next op sees.
type CurrentData<S> =
  S extends Bound<infer Shp extends Shape>
    ? Raw<Shp>
    : S extends Deferred<infer Out extends Shape>
      ? Raw<Out>
      : never;

// Retypes the surface after an op to reflect the new output shape.
type Reassembled<S, Shp extends Shape> =
  S extends Bound<any>
    ? Assembled<Bound<Shp>>
    : S extends Deferred<any>
      ? Assembled<Deferred<Shp>>
      : never;

// Reuses compose.ts's Tail directly (former PipeChain here was the same
// Op-detect-and-thread walk, twice).
//
// The runtime surface (below) is a plain callable function with methods
// attached via Object.defineProperty, cast to this type at its two
// construction points (`as unknown as Assembled<...>`). That's a
// deliberate, permanent boundary, not a gap to close: getting real
// inference through a dynamically-built function object would mean
// either rebuilding the surface per call with the narrowed generic
// baked in (breaks the "one function, no rebuild" runtime model) or a
// code-gen/proxy-based surface (a different assembly mechanism
// entirely). Two visible costs of this boundary, both accepted:
// `.pipe()`/`.compose()` on a Bound surface type as `unknown` rather
// than the real result type (tests use `as any` there on purpose, not
// as a workaround for a defect — see fixtures/assemble tests), and the
// runtime `compose` calls inside buildWrapper/buildDeferred are cast to
// `(...fns: Array<(x:any)=>any>) => ...`, discarding compose.ts's
// ComposeChain/Tail typing rather than reusing it.
type Assembled<S> = S & {
  extend<K extends string, Op1 extends Op<any, any, any>>(
    ops: Op1 extends Op<infer In, any, any>
      ? MatchesIn<In, Extract<CurrentData<S>, Shape>> extends Shape
        ? Record<K, Op1>
        : never
      : never,
  ): Op1 extends Op<any, infer Out, any>
    ? Reassembled<S, Out> & { [P in K]: Fluent<Op1> }
    : never;
  extend<Ops extends OpMap>(
    ops: Ops & {
      [K in keyof Ops]: Ops[K] extends Op<infer In, any, any>
        ? MatchesIn<In, Extract<CurrentData<S>, Shape>> extends Shape
          ? Ops[K]
          : never
        : never;
    },
  ): Assembled<S> & {
    [K in keyof Ops]: Fluent<Ops[K] & Op<any, any, any>>;
  };
  pipe<Fns extends [(arg: CurrentData<S>) => any, ...Array<(arg: any) => any>]>(
    ...fns: Fns & Tail<Fns, CurrentData<S>>
  ): S extends Bound<any> ? unknown : Assembled<S>;
  compose<
    Fns extends [(arg: CurrentData<S>) => any, ...Array<(arg: any) => any>],
  >(
    ...fns: Fns & Tail<Fns, CurrentData<S>>
  ): S extends Bound<any> ? unknown : Assembled<S>;
};

// --- Runtime surface builder ---
//
// Two kinds of surface, both callable:
//   - Deferred (from pirell()): no data yet. Methods/.pipe()/.compose() append
//     steps lazily. Calling it with raw JSON runs the steps and returns a
//     data-bound Wrapper surface.
//   - Wrapper (from pirell(data), or produced by calling a Deferred): raw JSON
//     is bound. Methods apply immediately to the current value and return a new
//     Wrapper. .pipe()/.compose() apply and return the raw JSON result.
// Surfaces are callable so a Wrapper can be fed back as input (value is reused,
// never re-run), which is what makes splitting a chain in two work.

const SURFACE = "__pirell";

const isSurface = (x: unknown): boolean =>
  x != null &&
  (typeof x === "function" || typeof x === "object") &&
  SURFACE in (x as any);

const valueOf = (x: unknown): unknown => (isSurface(x) ? (x as any).value : x);

const runSteps = (
  steps: Array<(data: unknown) => unknown>,
  data: unknown,
): unknown => steps.reduce((acc, step) => step(acc), data);

// Data-bound surface. `value` is the current raw JSON result.
function buildWrapper(value: unknown, ops: OpMap): Assembled<Bound<any>> {
  const wrapper = ((input: unknown): Assembled<Bound<any>> => {
    // Re-enter: reuse another surface's value, or bind raw data as-is.
    return buildWrapper(valueOf(input), ops);
  }) as unknown as Assembled<Bound<any>>;

  Object.defineProperty(wrapper, SURFACE, { value: true });
  Object.defineProperty(wrapper, "value", {
    get: () => value,
  });

  wireOps(wrapper, ops, (op, args) =>
    buildWrapper((op as (...a: any[]) => unknown)(value, ...args), ops),
  );

  (wrapper as any).extend = function <Ops extends OpMap>(added: Ops) {
    return buildWrapper(value, { ...ops, ...added });
  };

  (wrapper as any).pipe = function (...fns: Array<(x: any) => any>) {
    return (compose as (...fns: Array<(x: any) => any>) => (x: any) => any)(
      ...fns,
    )(value);
  };

  (wrapper as any).compose = function (...fns: Array<(x: any) => any>) {
    return (compose as (...fns: Array<(x: any) => any>) => (x: any) => any)(
      ...fns,
    )(value);
  };

  return wrapper;
}

// Lazy builder surface. `steps` accumulate until data is supplied.
function buildDeferred(
  steps: Array<(data: unknown) => unknown>,
  ops: OpMap,
): Assembled<Deferred<any>> {
  const deferred = ((input: unknown): Assembled<Bound<any>> => {
    if (isSurface(input)) {
      return buildWrapper(valueOf(input), ops);
    }
    return buildWrapper(runSteps(steps, input), ops);
  }) as unknown as Assembled<Deferred<any>>;

  Object.defineProperty(deferred, SURFACE, { value: true });
  Object.defineProperty(deferred, "value", {
    get: () => undefined,
  });

  wireOps(deferred, ops, (op, args) => {
    const step = (data: unknown) =>
      (op as (...a: any[]) => unknown)(data, ...args);
    return buildDeferred([...steps, step], ops);
  });

  (deferred as any).extend = function <Ops extends OpMap>(added: Ops) {
    return buildDeferred(steps, { ...ops, ...added });
  };

  (deferred as any).pipe = function (...fns: Array<(x: any) => any>) {
    return buildDeferred(
      [
        ...steps,
        (compose as (...fns: Array<(x: any) => any>) => (x: any) => any)(
          ...fns,
        ),
      ],
      ops,
    );
  };

  (deferred as any).compose = function (...fns: Array<(x: any) => any>) {
    return buildDeferred(
      [
        ...steps,
        (compose as (...fns: Array<(x: any) => any>) => (x: any) => any)(
          ...fns,
        ),
      ],
      ops,
    );
  };

  return deferred;
}

// pirell(data) → data-bound surface (Bound); pirell() → Deferred builder
export function pirell(data: unknown): Assembled<Bound<Dim[]>>;
export function pirell(): Assembled<Deferred<[]>>;
export function pirell(...args: [unknown] | []): unknown {
  if (args.length === 0) {
    return buildDeferred([], {});
  }
  return buildWrapper(rawPirell(args[0]).value, {});
}
