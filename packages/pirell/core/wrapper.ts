import type { Dim } from "./types.js";

// Bare data-bound surface: shape + value only. No methods — the
// assembly layer (core/index.ts) is the only place that wires .extend()
// and .pipe() onto a Wrapper instance, via wireOps.
export class Wrapper<S extends Dim[], T> {
  constructor(
    public readonly shape: S,
    public readonly value: T,
  ) {}
}
