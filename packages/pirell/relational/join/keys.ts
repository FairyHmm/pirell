/**
 * Key-matching strategies for {@linkcode join}: explicit tuples,
 * per-pair projections, and natural key inference.
 */

/** Explicit key pair: `[leftKey, rightKey]`. */
export type JoinKeys = readonly [leftKey: string, rightKey: string];

/** Compared value pair returned by {@linkcode JoinKeyFn}. */
export type JoinKeyValues = readonly [leftValue: unknown, rightValue: unknown];

/**
 * Per-pair projection over the caller's own row types. Returns the
 * compared values (not field names — those go in a tuple); the pair
 * matches on `===`.
 */
export type JoinKeyFn<R, S> = (left: R, right: S) => JoinKeyValues;

/** Shape-described row; value types are the caller's business. */
export type Row = Record<string, unknown>;

/**
 * A key resolver: samples in, names out. Value-independent by contract —
 * the join calls it once with first rows and hashes on the tuple, the
 * same as a written tuple. Carry the brand to plug in your own.
 */
export interface KeyResolver {
  (left: Row | undefined, right: Row | undefined): JoinKeys;
  readonly __keyResolver: true;
}

/** Pair predicate: same `===` comparison however the keys were given. */
export type Matcher = (left: Row, right: Row) => boolean;

/** Per-side key extractors, hashable when both exist. */
export type KeyFns = readonly [
  leftKey: (row: Row) => unknown,
  rightKey: (row: Row) => unknown,
];

/**
 * Per-side extractors for tuple/natural keys. `null` for pair
 * predicates: a JoinKeyFn reads both rows per pair, so its halves can't
 * split. Resolvers hash — they're branded value-independent (see below).
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

/**
 * Pair predicate from `on`: keyed forms compare extracted halves, a
 * function projects each pair to compared values.
 */
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

/**
 * Resolves the natural key: the shared field of both first rows, as an
 * explicit `on` tuple. Zero or multiple shared fields throws. Branded a
 * resolver, so passing this function as `on` hashes like the tuple —
 * pass the result for a written-tuple equivalent.
 */
export const naturalKey: KeyResolver = Object.assign(
  (left: Row | undefined, right: Row | undefined): JoinKeys => {
    const rightKeys = new Set(Object.keys(right ?? {}));
    const shared = Object.keys(left ?? {}).filter((k) => rightKeys.has(k));
    if (shared.length === 0)
      throw new Error(
        "join: no shared key between the tables — pass explicit `on`",
      );
    if (shared.length > 1)
      throw new Error(
        `join: ambiguous shared keys (${shared.join(", ")}) — pass explicit \`on\``,
      );
    const [key = ""] = shared;
    return [key, key];
  },
  { __keyResolver: true as const },
);
