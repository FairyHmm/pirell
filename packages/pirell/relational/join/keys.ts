/**
 * Key specs and matching strategies for {@linkcode join}. Inference
 * (`naturalKey`, `autoKey`) lives in `inference.ts`.
 */
import { naturalKey } from "./inference.js";

/** Explicit key pair: `[leftKey, rightKey]`. */
export type JoinKeys = readonly [leftKey: string, rightKey: string];

/** Compared value pair returned by {@linkcode JoinKeyFn}. */
export type JoinKeyValues = readonly [leftValue: unknown, rightValue: unknown];

/**
 * Per-pair projection over the caller's own row types: compared values
 * (not field names), matched on `===`.
 */
export type JoinKeyFn<R, S> = (left: R, right: S) => JoinKeyValues;

/** Shape-described row; value types are the caller's business. */
export type Row = Record<string, unknown>;

/**
 * A key resolver: samples in, names out, value-independent by contract,
 * so the join hashes the tuple. Brand to plug in your own.
 */
export interface KeyResolver {
  (left: Row | undefined, right: Row | undefined): JoinKeys;
  readonly __keyResolver: true;
}

/** Pair predicate: same `===` comparison however the keys were given. */
export type Matcher = (left: Row, right: Row) => boolean;

/**
 * Join strategy; default `inner`. `left`/`right` keep unmatched rows
 * from that side, `full` keeps both, `cross` pairs everything, `anti`
 * keeps left rows with no match, unmerged and unduplicated.
 */
export type JoinKind = "inner" | "left" | "right" | "full" | "cross" | "anti";

/**
 * Options for {@linkcode join}. Exclusive arms: keyed strategies take
 * `on`; `cross` takes none (passing `on` is a type error, ignored at
 * runtime).
 */
export type JoinOptions<R, S> =
  | {
      /** Strategy; default `"inner"`. `anti` keeps unmatched left rows, unmerged. */
      join?: "inner" | "left" | "right" | "full" | "anti";
      /** Explicit keys, a resolver (e.g. naturalKey), or per-pair projection. Omitted → natural key (single shared field). */
      on?: JoinKeys | JoinKeyFn<R, S> | KeyResolver;
    }
  | {
      /** Cartesian product. */
      join: "cross";
      on?: never;
    };

/** Paired per-side key extractors for hash indexing. */
export type KeyFns = readonly [
  leftKey: (row: Row) => unknown,
  rightKey: (row: Row) => unknown,
];

/**
 * Per-side extractors, or `null` for pair predicates (halves can't
 * split). Branded resolvers hash.
 */
export const resolveKeyFns = <R, S>(
  left: Row | undefined,
  right: Row | undefined,
  on: JoinKeys | JoinKeyFn<R, S> | KeyResolver | undefined,
): KeyFns | null => {
  if (typeof on === "function") {
    if (!isResolver(on)) return null;
    return keyed(on(left, right));
  }
  return keyed(on ?? naturalKey(left, right));
};

const keyed = ([lk, rk]: JoinKeys): KeyFns => [(l) => l[lk], (r) => r[rk]];

// Resolver protocol, never identity: any present or future branded
// resolver hashes; unbranded functions stay predicates.
const isResolver = (on: (...args: never[]) => unknown): on is KeyResolver =>
  "__keyResolver" in on;

/** Pair predicate from `on`: keyed halves compared, pairs projected. */
export const resolveMatcher = <R, S>(
  left: Row | undefined,
  right: Row | undefined,
  on: JoinKeys | JoinKeyFn<R, S> | KeyResolver | undefined,
): Matcher => {
  const keyFns = resolveKeyFns(left, right, on);
  if (keyFns) {
    const [lk, rk] = keyFns;
    return (l, r) => lk(l) === rk(r);
  }
  // resolveKeyFns returns null exactly for pair predicates (see above).
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- null ⟺ pair predicate (see resolveKeyFns)
  const keyFn = on as JoinKeyFn<R, S>;
  return (l, r) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the caller-owned row contract (see join.ts seam comment)
    const pair = keyFn(l as R, r as S);
    return pair[0] === pair[1];
  };
};
