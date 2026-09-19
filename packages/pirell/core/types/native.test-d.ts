// Compile-time-only pins for scalar native surfaces — statically
// checked, never runs (no runtime serves these until the delegation arm).
/* eslint-disable no-unused-expressions -- absence pins are bare member accesses by design: nothing exists to invoke */
import { expectTypeOf } from "vitest";
import { pirell } from "../index.js";

// Strings describe themselves: split rewraps as a column.
expectTypeOf(pirell("a,b").split(",").value).toEqualTypeOf<unknown[]>();
// String-returning methods stay stringy (recursive).
expectTypeOf(
  pirell("hi").toUpperCase().toLowerCase().value,
).toEqualTypeOf<unknown>();
// Numbers/bigints describe themselves too; string results chain on.
expectTypeOf(pirell(5).toFixed(2).split(".").value).toEqualTypeOf<unknown[]>();
expectTypeOf(pirell(5n).toString().value).toEqualTypeOf<unknown>();
// Literals match via their general type.
pirell("a,b").split(",");
pirell(5).toFixed(2);

// Absence pins read as bare access (no call — nothing to invoke).
// @ts-expect-error -- kind mismatch: numbers have no split
pirell(5).split;
// @ts-expect-error -- booleans are method-less scalars
pirell(true).toUpperCase;
// @ts-expect-error -- unions match several kinds: fail-closed
pirell(Math.random() > 0.5 ? "a" : 1).split;
// @ts-expect-error -- any matches everything: fail-closed, runtime still works
pirell(JSON.parse('"a"')).split;
// @ts-expect-error -- array natives land in a later phase (flips then)
pirell([1, 2]).split;
