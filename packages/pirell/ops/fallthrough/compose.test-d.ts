// Compile-time-only pin for native shape rejection (see compose.test.ts) —
// statically checked, never runs.
import { pirell } from "../index.js";

// @ts-expect-error -- map expects indexed, not ["k", ...]
pirell({ a: 1 }).map((n: unknown) => n);
// @ts-expect-error -- keys expects keyed, not ["i", ...]
pirell([1, 2]).keys();
// @ts-expect-error -- find expects indexed, not ["k", ...]
pirell({ a: 1 }).find((n: unknown) => n);
// @ts-expect-error -- hasOwn expects keyed, not ["i", ...]
pirell([1, 2]).hasOwn("0");
