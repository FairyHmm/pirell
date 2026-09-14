import type { DataOf } from "./codec.js";

// --- Dim & Elem representation ---

/** Positional (`"i"`) vs named (`"k"`) fork — the two JSON shapes. */
export type Dim = "i" | "k";

/**
 * A nested shape, a leaf type, or an object. `unknown` excluded: it
 * absorbs unions and collapses comparisons.
 */
export type Branch =
  Shape | (string & {}) | (number & {}) | (boolean & {}) | object;

/**
 * A mixed node's children: positional (`Branch[]`) vs named
 * (`Record`), kept distinct rather than force-unified.
 */
export type Variants = Branch[] | Record<string, Branch>;

/** `"i..."` / `"k..."`: a dimension with heterogeneous children. */
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

/**
 * The canonical `Elem` classifier — matchers branch off its fields.
 * Bare-vs-declared stays visible: it drives the matcher's
 * continuation.
 */
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

// Shape↔type mapping lives in codec.ts (DataOf/ShapeOf are inverses —
// same ladder, opposite directions). Raw/Op below build on DataOf.

// Unbranded: the old unique-symbol brand was never structurally tested
// by any consumer, and a private symbol can't be named by packages
// re-exporting it (TS4023 → TS7056).
/**
 * `DataOf` with an unknown-guard: unshaped claims collapse to plain
 * `unknown` instead of an unsatisfiable type.
 */
export type Raw<S extends Shape> = [unknown] extends [DataOf<S>]
  ? unknown
  : DataOf<S>;

/**
 * A shape-claimed data function. Data carries its own `In`; parameterized
 * ops are factories returning `Op` — the surface applies args, then
 * checks once.
 */
export type Op<In extends Shape, Out extends Shape> = (
  data: DataOf<In>,
) => Raw<Out>;

// Both arms return `(data: any) => any` — `Op<any, any>`'s param resolves
// to `DataOf<any>` = unknown, which would reject any aliased concrete op
// (TS only fast-path-compares direct Op instantiations).
/**
 * Anything registrable via `.extend()`: a data op, or a factory
 * yielding one once applied. The `any`s are a container check only —
 * `Fluent` still gates real per-call shapes, and the raw factory
 * output is exactly what `runOp` applies.
 */
export type OpLike =
  | ((data: any) => any)
  | ((...args: any[]) => (data: any) => any);

/**
 * Type-level tag for a data-bound surface: shape `S` proven from data.
 * Named `Bound` (not `Wrapper`) to avoid colliding with the runtime
 * class of the same concept.
 */
export interface Bound<S extends Shape> {
  readonly __shape?: S;
  value: unknown;
}

/**
 * A surface with no data yet: calling it binds data. Deliberately
 * bare — the rich ops-aware call signature cost ~2,354 insts merely
 * to declare, so it lives in `assembled.ts`, applied via intersection
 * (runtime invoke unaffected — type-level only).
 */
export interface Deferred<Out extends Shape> {
  (data: unknown): Bound<Out>;
  readonly value: undefined;
}
