// Compile-time-only pin (see extend.test.ts) — statically checked, never runs.
// The runtime twin of this rejection is tested separately via the arity check.
import { extend } from "./extend.js";
import { nth } from "../ops/fixture-ops.js";

// @ts-expect-error -- nth is a factory (returns a data fn), and
// extend(fn) only accepts single-stage data ops.
extend(nth);
