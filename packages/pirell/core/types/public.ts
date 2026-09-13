// Public type API. Op (plus shape literals) for writing ops; the surface
// names are what cross-package .d.ts emit references, so they can't be
// private (TS4023 otherwise). Everything else imports directly from its
// own type file.
export type { Op, Bound, Deferred } from "./base.js";
export type { ShapeOf } from "./codec.js";
export type { OpMethods } from "./fluent.js";
export type { ISurface, IComposable } from "./assembled.js";
