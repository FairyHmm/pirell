import type { DataOf } from "./codec.js";

// --- Dim & Elem representation ---

/** Indexed `i` vs keyed `k` fork — the two JSON shapes. */
export type Dim = "i" | "k";

/** A nested shape, a leaf type, or an object (`unknown` excluded — it absorbs unions). */
export type Branch =
  // eslint-disable-next-line sonarjs/no-useless-intersection -- `string & {}` is the literal-branding idiom: it keeps `string`-literals from being absorbed by the union while still matching plain string leaves
  Shape | (string & {}) | (number & {}) | (boolean & {}) | object;

/** A mixed node's children: positional or named. */
export type Variants = Branch[] | Record<string, Branch>;

/** Dimension with heterogeneous children. */
export type MixedTag = `${Dim}...`;

/** One shape element: bare dim, mixed tag, or a declared pair. */
export type Elem = Dim | MixedTag | [Dim, Branch] | [MixedTag, Variants];

/** Bare-tag to dim lookup for `ElemCase`'s mixed arms. */
export type DimTable = {
  i: "i";
  "i...": "i";
  k: "k";
  "k...": "k";
};

/**
 * A shape: elements plus an optional open tail. Tails apply to nested
 * shapes only; mixed tags are terminal.
 */
export type Shape = Elem[] | [...Elem[], "..."];

/** The canonical {@linkcode Elem} classifier — matchers branch off its fields. */
export type ElemCase<E extends Elem> = E extends Dim
  ? { dim: E; kind: "leaf"; branch: never; variants: never }
  : E extends MixedTag
    ? { dim: DimTable[E]; kind: "mixed"; branch: never; variants: never }
    : E extends [infer D extends Dim, infer B extends Branch]
      ? { dim: D; kind: "leaf"; branch: B; variants: never }
      : E extends [infer T extends MixedTag, infer V extends Variants]
        ? { dim: DimTable[T]; kind: "mixed"; branch: never; variants: V }
        : never;

// --- Data / Op ---

// Shape↔type mapping lives in codec.ts; Raw/Op build on DataOf.

// Unbranded — a private unique-symbol brand can't be named by packages
// re-exporting it (TS4023 → TS7056).
/**
 * {@linkcode DataOf} with an unknown-guard: unshaped claims collapse to plain
 * `unknown` instead of an unsatisfiable type.
 */
export type Raw<S extends Shape> = [unknown] extends [DataOf<S>]
  ? unknown
  : DataOf<S>;

/** A shape-claimed data function: data `In` → data `Out`. */
export type Op<In extends Shape, Out extends Shape> = (
  data: DataOf<In>,
) => Raw<Out>;

// `Op<any, any>`'s param resolves to `DataOf<any>` = unknown, which
// would reject aliased concrete ops — so both arms stay bare-fn.
/**
 * Anything registrable via {@linkcode extend}: a data op, or a factory
 * yielding one once applied.
 */
export type OpLike =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the registrable union's params are caller-authored (typed ops must match by any); documented above the type
  ((data: any) => any) | ((...args: any[]) => (data: any) => any);

/** Type-level tag for a data-bound surface: shape `S` proven from data. */
export interface Bound<S extends Shape> {
  readonly __shape?: S;
  value: unknown;
}

/** A surface with no data yet: calling it binds data. */
export interface Deferred<Out extends Shape> {
  (data: unknown): Bound<Out>;
  readonly value: undefined;
}

/** A method table: names to registrable ops. */
export type OpMap = Record<string, OpLike>;

/** Bound value read off the surface's shape (Deferred checked first — it satisfies Bound too). */
export type CurrentData<S> =
  S extends Deferred<infer Out extends Shape>
    ? Raw<Out>
    : S extends Bound<infer Shp extends Shape>
      ? Raw<Shp>
      : never;

/** The surface's proven shape, read fresh at each call. */
export type CurrentShp<S> =
  S extends Deferred<infer Out extends Shape>
    ? Out
    : S extends Bound<infer Shp extends Shape>
      ? Shp
      : ["..."];
