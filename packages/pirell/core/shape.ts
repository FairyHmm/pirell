import type { Dim } from "./types.js";

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

// Runtime prefix-check against op's declared In, resolves only In.length levels
export function matchesInPrefix(op: { in?: Dim[] }, shape: Dim[]): boolean {
  const inDims = op.in;
  if (inDims === undefined || inDims.length === 0) return true;
  for (let i = 0; i < inDims.length; i++) {
    const actual = resolveShapeAt(shape, i)[i];
    if (actual === undefined || actual !== inDims[i]) return false;
  }
  return true;
}

// Structural equality of two declared shapes — for build-time chain checking
function dimsEqual(a: readonly Dim[], b: readonly Dim[]): boolean {
  return a.length === b.length && a.every((d, i) => d === b[i]);
}

// Check if chaining next after prevOut is provably valid (no data needed)
export function chainableAt(
  prevOut: readonly Dim[] | undefined,
  next: { in?: Dim[] },
): boolean {
  if (prevOut === undefined || next.in === undefined) return true;
  const n = Math.min(prevOut.length, next.in.length);
  return dimsEqual(prevOut.slice(0, n), next.in.slice(0, n));
}
