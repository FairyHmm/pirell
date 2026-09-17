/**
 * Predicate ops with a field-name shorthand: `filter`, `find`,
 * `findLast`, `some`, `every` — a string tests that field's
 * truthiness, a function is the predicate. Generic over any indexed
 * input.
 *
 * ```ts
 * import { pirell } from "@pirell/ops";
 *
 * pirell(users).filter("email").value; // users having an email
 * ```
 *
 * @module
 */
import type { ArrayCallback, Rewrap, Terminal } from "../fallthrough/array.js";
import { read } from "./methods.js";

/** A predicate, or a field name tested for truthiness (caller-typed). */
export type PredicateKey = string | ArrayCallback;

/**
 * Keeps matching elements, staying an open column.
 *
 * @param predOrKey Predicate, or field name tested for truthiness.
 */
export const filter =
  (predOrKey: PredicateKey): Rewrap =>
  (data) =>
    data.filter(toPred(predOrKey));

/**
 * Returns the first match, or `undefined`.
 *
 * @param predOrKey Predicate, or field name tested for truthiness.
 */
export const find =
  (predOrKey: PredicateKey): Terminal =>
  (data) =>
    data.find(toPred(predOrKey));

/**
 * Returns the last match, or `undefined`.
 *
 * @param predOrKey Predicate, or field name tested for truthiness.
 */
export const findLast =
  (predOrKey: PredicateKey): Terminal =>
  (data) =>
    data.findLast(toPred(predOrKey));

/**
 * Answers whether any element matches.
 *
 * @param predOrKey Predicate, or field name tested for truthiness.
 */
export const some =
  (predOrKey: PredicateKey): Terminal =>
  (data) =>
    data.some(toPred(predOrKey));

/**
 * Answers whether every element matches.
 *
 * @param predOrKey Predicate, or field name tested for truthiness.
 */
export const every =
  (predOrKey: PredicateKey): Terminal =>
  (data) =>
    data.every(toPred(predOrKey));

// Seam: strings test a caller-promised field's truthiness.
const toPred = (predOrKey: PredicateKey): ArrayCallback =>
  typeof predOrKey === "function" ? predOrKey : (row) => read(row, predOrKey);
