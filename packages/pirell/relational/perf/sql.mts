/**
 * SQL workload bench over real MDN compat data (20k features, 280k
 * support rows): each query runs as a pirell pipeline and as a
 * hand-rolled native baseline, checked for equal results. Min
 * across runs is primary (pauses only ever add).
 *
 * Usage: pnpm perf:sql [--flags]   (from packages/pirell/relational)
 *   --case name   run a single case
 *
 * @module
 */
import { pipe } from "@pirell/core";
import { filter } from "@pirell/ops";
import { pirell } from "../index.js";
import { join } from "../join/join.js";
import type { Feature, Release, Support } from "./bcd.js";
import { tables } from "./bcd.js";

const USAGE = `SQL workload bench over BCD: ms/call (min across runs), wrap vs native.
  --case name   run a single case
  -h, --help    print this and exit`;

const RUNS = 7;
const TARGET_MS = 400;
const MIN_ITERS = 1;
const MAX_ITERS = 100_000;

// Blackhole: defeat dead-code elimination without I/O in the loop.
let sink: unknown = null;

interface Case {
  name: string;
  rows: () => number;
  wrap: () => unknown;
  native: () => unknown;
}

const byPath = (a: { path: string }, b: { path: string }): number =>
  a.path < b.path ? -1 : a.path > b.path ? 1 : 0;

const byCountDesc = (a: { n: number }, b: { n: number }): number => b.n - a.n;

const byDateDesc = (a: { date: string }, b: { date: string }): number =>
  a.date < b.date ? -1 : a.date > b.date ? 1 : 0;

const { features, support, releases, sparsest } = tables();
const sparseSupport = support.filter((s) => s.browser === sparsest);
const nestedSubset = support.slice(0, 1000);
console.log(
  `BCD: ${features.length} features, ${support.length} support rows, ` +
    `${releases.length} releases; anti target: ${sparsest} ` +
    `(${sparseSupport.length} rows); nested subset: ${nestedSubset.length} rows.`,
);

const CASES: Case[] = [
  {
    // SELECT path FROM features WHERE deprecated ORDER BY path LIMIT 100
    name: "where-sort-take",
    rows: () => pirell(features).filter("deprecated").value.length,
    wrap: () =>
      pirell(features).filter("deprecated").sort("path").take(100).value,
    native: () =>
      features
        .filter((f) => f.deprecated)
        .sort(byPath)
        .slice(0, 100),
  },
  {
    // SELECT * FROM support JOIN features ON support.path = features.path
    name: "join-hash",
    rows: () => support.length,
    wrap: () => pirell(support).join(features, { on: ["path", "path"] }).value,
    native: () => {
      const dim = new Map(features.map((f) => [f.path, f]));
      return support.map((s) => ({ ...s, ...dim.get(s.path)! }));
    },
  },
  {
    // Same join through the pair-predicate path (subset: 1k x 20k
    // pairs). Standalone+pipe: the fluent surface erases the key
    // function's row generics, same as in join.test.ts.
    name: "join-nested",
    rows: () => nestedSubset.length * features.length,
    wrap: () =>
      pipe(
        nestedSubset,
        join(features, {
          on: (l: Support, r: Feature): [string, string] => [l.path, r.path],
        }),
      ),
    native: () => {
      const out = [];
      for (const l of nestedSubset)
        for (const r of features)
          if (l.path === r.path) out.push({ ...l, ...r });
      return out;
    },
  },
  {
    // SELECT browser, COUNT(*) FROM support GROUP BY browser
    name: "group-count",
    rows: () => support.length,
    wrap: () =>
      pirell(support)
        .groupBy("browser")
        .entries()
        .map(([browser, rows]: [string, Support[]]) => ({
          browser,
          n: rows.length,
        })).value,
    native: () => {
      const counts = new Map<string, number>();
      for (const s of support)
        counts.set(s.browser, (counts.get(s.browser) ?? 0) + 1);
      return [...counts.entries()].map(([browser, n]) => ({ browser, n }));
    },
  },
  {
    // SELECT * FROM features WHERE path NOT IN (sparse support paths)
    name: "anti",
    rows: () => features.length,
    wrap: () =>
      pirell(features).join(sparseSupport, {
        on: ["path", "path"],
        join: "anti",
      }).value,
    native: () => {
      const covered = new Set(sparseSupport.map((s) => s.path));
      return features.filter((f) => !covered.has(f.path));
    },
  },
  {
    // Deprecated-support report: join, group, per-group filter, count,
    // sort, take. Filter rides `each` past grouping: a filtered Indexed
    // column no longer satisfies groupBy's Table claim.
    name: "report",
    rows: () => support.length,
    wrap: () =>
      pirell(support)
        .join(features, { on: ["path", "path"] })
        .groupBy("browser")
        .each(filter("deprecated"))
        .entries()
        .map(([browser, rows]: [string, unknown[]]) => ({
          browser,
          n: rows.length,
        }))
        .filter((r: { n: number }) => r.n > 0)
        .sort(byCountDesc)
        .take(5).value,
    native: () => {
      const dim = new Map(features.map((f) => [f.path, f]));
      const counts = new Map<string, number>();
      for (const s of support) {
        const f = dim.get(s.path);
        if (f?.deprecated)
          counts.set(s.browser, (counts.get(s.browser) ?? 0) + 1);
      }
      return [...counts.entries()]
        .map(([browser, n]) => ({ browser, n }))
        .sort(byCountDesc)
        .slice(0, 5);
    },
  },
  {
    // SELECT * FROM releases WHERE status = 'current' ORDER BY date DESC
    name: "releases-current",
    rows: () => releases.length,
    wrap: () =>
      pirell(releases)
        .filter((r: Release) => r.status === "current")
        .sort(byDateDesc)
        .take(10).value,
    native: () =>
      releases
        .filter((r) => r.status === "current")
        .sort(byDateDesc)
        .slice(0, 10),
  },
];

const gc = (globalThis as { gc?: () => void }).gc;

const calibrate = (run: () => unknown): number => {
  const PROBE = 4;
  const t0 = performance.now();
  for (let i = 0; i < PROBE; i++) sink = run();
  const perCallMs = (performance.now() - t0) / PROBE;
  return Math.min(
    MAX_ITERS,
    Math.max(MIN_ITERS, Math.round(TARGET_MS / Math.max(perCallMs, 1e-9))),
  );
};

const arg = (name: string): string | null => {
  const argv = process.argv.slice(2);
  if (argv.includes("-h") || argv.includes("--help")) {
    console.log(USAGE);
    process.exit(0);
  }
  const i = argv.indexOf(`--${name}`);
  return i < 0 ? null : (argv[i + 1] ?? null);
};
const only = arg("case");
if (only && !CASES.some((c) => c.name === only))
  throw new Error(`unknown case: ${only}`);

const time = (
  run: () => unknown,
): { min: number; med: number; iters: number } => {
  for (let i = 0; i < 3; i++) sink = run();
  const iters = calibrate(run);
  const perCall: number[] = [];
  for (let r = 0; r < RUNS; r++) {
    gc?.();
    const t0 = performance.now();
    for (let i = 0; i < iters; i++) sink = run();
    perCall.push((performance.now() - t0) / iters);
  }
  perCall.sort((a, b) => a - b);
  return {
    min: perCall[0]!,
    med: perCall[Math.floor(perCall.length / 2)]!,
    iters,
  };
};

const pad = (s: string, w: number): string => s.padEnd(w);
const num = (n: number): string => n.toLocaleString("en-US");

const head = ["case", "min ms/call", "median ms/call", "iters", "rows in"];
const lines: string[][] = [];
const mins = new Map<string, number>();
for (const c of CASES) {
  if (only && c.name !== only) continue;
  // Equal results, checked once outside the clock.
  const a = JSON.stringify(c.wrap());
  const b = JSON.stringify(c.native());
  if (a !== b) throw new Error(`${c.name}: wrap/native mismatch`);
  const w = time(c.wrap);
  const n = time(c.native);
  mins.set(`${c.name}:wrap`, w.min);
  mins.set(`${c.name}:native`, n.min);
  const rows = num(c.rows());
  lines.push(
    [c.name, w.min.toFixed(1), w.med.toFixed(1), num(w.iters), rows],
    ["  native", n.min.toFixed(1), n.med.toFixed(1), num(n.iters), rows],
  );
}
const widths = head.map((h, i) =>
  Math.max(h.length, ...lines.map((l) => (l[i] ?? "").length), 3),
);
const line = (cells: string[]): string =>
  `| ${cells.map((c, i) => pad(c, widths[i]!)).join(" | ")} |`;
console.log(
  [
    line(head),
    `|${widths.map((w) => "-".repeat(w + 2)).join("|")}|`,
    ...lines.map(line),
  ].join("\n"),
);
if (!only) {
  const ratio = (name: string): string => {
    const w = mins.get(`${name}:wrap`);
    const n = mins.get(`${name}:native`);
    if (w === undefined || n === undefined || n <= 0) return "—";
    // Below the timer floor both forms read 0.0 — no ratio to report.
    if (w < 0.05 || n < 0.05) return "floor";
    return `${(w / n).toFixed(1)}×`;
  };
  console.log(
    `wrap:native  ${CASES.map((c) => `${c.name} ${ratio(c.name)}`).join("  ")}`,
  );
}
console.log(`(sink: ${typeof sink})`);
