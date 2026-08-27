import type { Dim, ShapeElem } from "./types.js";

// Runtime marker for mixed dims (i.e. "i...") — not part of Dim union
const MIXED_MARKER = "...";

function children(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (value !== null && typeof value === "object") {
    return Object.values(value as Record<string, unknown>);
  }
  return null;
}

function outerDim(value: unknown): Dim | null {
  if (Array.isArray(value)) return "i";
  if (value !== null && typeof value === "object") return "k";
  return null;
}

// Lazy resolution: cost paid per depth actually requested
export class Shapes {
  private readonly cache: Dim[] = [];
  private frontier: unknown[];
  private terminated = false;

  constructor(root: unknown) {
    this.frontier = [root];
  }

  // Resolve depths [0, depth] inclusive; already-resolved depths are free
  ensure(depth: number): void {
    while (!this.terminated && this.cache.length <= depth) {
      const dim = outerDim(this.frontier[0]);
      if (dim === null) {
        this.terminated = true;
        break;
      }
      const uniformDim = this.frontier.every((n) => outerDim(n) === dim);
      if (!uniformDim) {
        this.cache.push(MIXED_MARKER as Dim);
        this.terminated = true;
        break;
      }
      this.cache.push(dim);
      const nextFrontier = this.frontier.flatMap(
        (node) => children(node) ?? [],
      );
      if (nextFrontier.length === 0) {
        // Empty array/object: nothing deeper to compare, shape ends here
        this.terminated = true;
        break;
      }
      this.frontier = nextFrontier;
    }
  }

  get resolvedLength(): number {
    return this.cache.length;
  }

  get isTerminated(): boolean {
    return this.terminated;
  }

  at(depth: number): Dim | undefined {
    this.ensure(depth);
    return this.cache[depth];
  }

  // Force full resolution: expensive full-tree walk, use only when needed
  resolveAll(): Dim[] {
    while (!this.terminated) this.ensure(this.cache.length);
    return [...this.cache];
  }
}

const LAZY = new WeakMap<object, Shapes>();

// Lazy proxy: reads/iterates like Dim[] but resolves only as deep as accessed
export function makeLazyShapeProxy(root: unknown): Dim[] {
  const lazy = new Shapes(root);
  const proxy = new Proxy([] as Dim[], {
    get(_target, prop, receiver) {
      if (prop === "length") return lazy.resolveAll().length;
      if (typeof prop === "string" && /^\d+$/.test(prop)) {
        return lazy.at(Number(prop));
      }
      // Other property/method access needs the real array — no cheaper answer
      return Reflect.get(lazy.resolveAll(), prop, receiver);
    },
    has(_target, prop) {
      return Reflect.has(lazy.resolveAll(), prop);
    },
    ownKeys() {
      return Reflect.ownKeys(lazy.resolveAll());
    },
    getOwnPropertyDescriptor(_target, prop) {
      return Reflect.getOwnPropertyDescriptor(lazy.resolveAll(), prop);
    },
  }) as unknown as Dim[];
  LAZY.set(proxy as unknown as object, lazy);
  return proxy;
}

// Resolve shape only up to depth; falls back for non-lazy shapes
export function resolveShapeAt(shape: Dim[], depth: number): Dim[] {
  const lazy = LAZY.get(shape as unknown as object);
  if (lazy === undefined) return shape.slice(0, depth + 1);
  lazy.ensure(depth);
  const out: Dim[] = [];
  for (let i = 0; i <= depth; i++) {
    const d = lazy.at(i);
    if (d === undefined) break;
    out.push(d);
  }
  return out;
}

// Debug helper: forces full resolution, prefer resolveShapeAt for hot paths
export function fullShape(shape: Dim[]): Dim[] {
  const lazy = LAZY.get(shape as unknown as object);
  return lazy === undefined ? [...shape] : lazy.resolveAll();
}

// Resolve the outer 'i'/'k' string for any ShapeElem (named, mixed, or plain).
function elemOuterDim(e: ShapeElem): Dim | null {
  if (typeof e === "string") return e as Dim;
  if ("__mixed" in e) return (e as { __mixed: Dim }).__mixed;
  if ("__indexed" in e) return "i";
  if ("__keyed" in e) return "k";
  return null;
}

// Runtime prefix-check against op's declared In, resolves only In.length levels.
// Mixed<D>/Indexed<T>/Keyed<T> in op.in: outer dim must match actual; type params
// are compile-time only and not checked at runtime.
export function matchesInPrefix(
  op: { in?: ShapeElem[] },
  shape: ShapeElem[],
): boolean {
  const inElems = op.in;
  if (inElems === undefined || inElems.length === 0) return true;
  for (let i = 0; i < inElems.length; i++) {
    const actual = resolveShapeAt(shape as Dim[], i)[i] as
      ShapeElem | undefined;
    if (actual === undefined) return false;
    const expected = inElems[i]!;
    const expectedDim = elemOuterDim(expected);
    const actualDim = elemOuterDim(actual);
    if (expectedDim !== actualDim) return false;
  }
  return true;
}

// Structural equality of two declared shape elements — for build-time chain checking.
// All object forms (Mixed, Indexed, Keyed) compare by outer dim only.
function elemsEqual(a: ShapeElem, b: ShapeElem): boolean {
  return elemOuterDim(a) === elemOuterDim(b);
}

function elemsArrayEqual(
  a: readonly ShapeElem[],
  b: readonly ShapeElem[],
): boolean {
  return a.length === b.length && a.every((e, i) => elemsEqual(e, b[i]!));
}

// Check if chaining next after prevOut is provably valid (no data needed)
export function chainableAt(
  prevOut: readonly ShapeElem[] | undefined,
  next: { in?: ShapeElem[] },
): boolean {
  if (prevOut === undefined || next.in === undefined) return true;
  const n = Math.min(prevOut.length, next.in.length);
  return elemsArrayEqual(prevOut.slice(0, n), next.in.slice(0, n));
}
