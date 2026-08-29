import type { Dim } from "./types.js";

// Bare data-bound surface: value only, untyped. Shape is a compile-time
// claim an Op's signature makes about the data (see types.ts's
// Pirell/__shape), not something the data itself carries or returns at
// runtime — and not a second value-type channel either (see Op in
// types.ts). data is always JSON; each Op narrows it as needed.
export class Wrapper<S> {
  constructor(public readonly value: unknown) {}
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
