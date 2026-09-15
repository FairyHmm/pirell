// Public type API: op-writing types (Op + shape literals), plus the
// surface names cross-package .d.ts emit references — those can't be
// private (TS4023 otherwise).
export type { Op, Bound, Deferred } from "./base.js";
export type { ShapeOf } from "./codec.js";
export type { OpMethods } from "./fluent.js";
export type {
  Assembled,
  ResolvedOpsDeferred,
  Extended,
  BoundWith,
  OpMap,
} from "./assembled.js";
