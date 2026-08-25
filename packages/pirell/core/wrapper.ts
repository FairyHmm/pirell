import type { Dim, Op, Pirell } from "./types.js";
import { wireOps } from "./extend.js";

export class Wrapper<S extends Dim[], T> {
  constructor(
    public readonly shape: S,
    public readonly value: T,
  ) {}

  // Return type is cast at the call site (type-safety.md §4's `as any`
  // gap) — class field types can't be generic over a this-inferred
  // fluent method map, so the static contract lives in Fluent<Op> rather
  // than in this class's declared shape.
  extend<Ops extends Record<string, Op<any, any, any, any, any>>>(
    ops: Ops,
  ): this & { [K in keyof Ops]: (...args: any[]) => any } {
    wireOps(this, ops, (op, args) => {
      const result = op(
        { shape: this.shape, value: this.value } as Pirell<any, any>,
        ...args,
      );
      return new Wrapper(result.shape, result.value);
    });
    return this as any;
  }
}
