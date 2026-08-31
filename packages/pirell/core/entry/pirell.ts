import type { Dim } from "../types/types.js";

// Bare data-bound surface: value only, untyped (shape is a compile-time claim).
export class Wrapper<S> {
  constructor(public readonly value: unknown) {
    // Mirror pirell(undefined): a Wrapper must never hold undefined.
    if (value === undefined) {
      throw new TypeError(
        "Wrapper cannot hold undefined — pass a JSON value. Use assemble.ts's pirell() with no args for the deferred-builder form.",
      );
    }
  }
}

export function pirell<T>(data: T): Wrapper<Dim[]> {
  // pirell(undefined) is distinct from a missing argument — throw explicitly
  if (arguments.length === 0 || data === undefined) {
    throw new TypeError(
      "pirell(undefined) is not valid — pass a JSON value. Use assemble.ts's pirell() for the deferred-builder form.",
    );
  }
  return new Wrapper(data);
}
