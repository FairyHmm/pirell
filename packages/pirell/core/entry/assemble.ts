import { pirell as rawPirell } from "./pirell.js";
import type {
  Bound,
  Deferred,
  Dim,
  Fluent,
  Op,
  Raw,
  Shape,
} from "../types/types.js";
import type { MatchesIn } from "../types/match.js";
import { wireOps } from "./extend.js";
import { compose } from "./compose.js";
import type { Tail } from "../types/chain.js";
import { SURFACE, isSurface, valueOf } from "./surface.js";

// Single wiring point: primitives stay ignorant of each other.

type OpMap = Record<string, Op<any, any, any>>;

// Unified output type: Bound and Deferred both resolve to what the next op
// sees. Not unified with chain.ts's link matching: this type unwraps a
// *surface* whose Shape param (Bound<Shp>/Deferred<Out>) is always already
// proven, so it never needs structural inference — CurrentShp below is
// exactly the proven shape Tail threads as CurShp, and this type's Raw<Shp>
// result is the Cur value threaded alongside it. One layer above, not a
// duplicate. See PLAN.md's "Unify ShapeOfCur/CurrentData" step for the
// comparison.
type CurrentData<S> =
  S extends Bound<infer Shp extends Shape>
    ? Raw<Shp>
    : S extends Deferred<infer Out extends Shape>
      ? Raw<Out>
      : never;

// Proven shape of CurrentData<S> — the CurShp half of Tail's threading.
// Always in lockstep with CurrentData above: Raw<Shp> value, Shp shape.
type CurrentShp<S> =
  S extends Bound<infer Shp extends Shape>
    ? Shp
    : S extends Deferred<infer Out extends Shape>
      ? Out
      : ["..."];

// Retypes the surface after an op to reflect the new output shape.
type Reassembled<S, Shp extends Shape> =
  S extends Bound<any>
    ? Assembled<Bound<Shp>>
    : S extends Deferred<any>
      ? Assembled<Deferred<Shp>>
      : never;

// Reuses chain.ts's Tail. The runtime surface is built once as a plain
// callable with defineProperty'd methods, then cast to this type — real
// type inference through a per-call rebuild is an intentional non-goal.
//
// compose() is Deferred-only. A Bound surface already has data — there is
// no un-applied state left to compose into, so top-level compose's "return
// a function, don't apply yet" contract has nothing to mean there. pipe()
// already covers the sole sensible Bound case (apply now, return the raw
// result). Giving Bound a compose() that actually applies immediately
// (matching pipe(), because that's the only thing it could do) would keep
// the name but silently invert what it promises everywhere else in the
// package — worse than not having the method.
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
    ...fns: Fns & Tail<Fns, CurrentData<S>, CurrentShp<S>>
  ): S extends Bound<any> ? unknown : Assembled<S>;
} & (S extends Deferred<any>
  ? {
      compose<
        Fns extends [(arg: CurrentData<S>) => any, ...Array<(arg: any) => any>],
      >(
        ...fns: Fns & Tail<Fns, CurrentData<S>, CurrentShp<S>>
      ): Assembled<S>;
    }
  : {});

// --- Runtime surface builder ---
//
// Both surface kinds are callable (composition.md): a Deferred appends
// steps lazily until data arrives; a Wrapper applies them immediately.
// Callability lets a bound Wrapper feed back as input, reusing its value.

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
    buildWrapper(
      (op as unknown as (...a: any[]) => (data: unknown) => unknown)(...args)(
        value,
      ),
      ops,
    ),
  );

  (wrapper as any).extend = function <Ops extends OpMap>(added: Ops) {
    return buildWrapper(value, { ...ops, ...added });
  };

  (wrapper as any).pipe = function (...fns: Array<(x: any) => any>) {
    return (compose as (...fns: Array<(x: any) => any>) => (x: any) => any)(
      ...fns,
    )(value);
  };

  // No .compose() here — a Bound surface already has data; there's no
  // deferred state to compose into, so it would just be pipe() under a
  // name that promises the opposite (see Assembled<S>'s comment above).

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
      (op as unknown as (...a: any[]) => (data: unknown) => unknown)(...args)(
        data,
      );
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
