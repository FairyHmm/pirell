// Type-cost probe: measures tsc instantiation deltas for synthetic call-site
// matrices, so type-machinery changes can be compared against a baseline.
//
// Usage: `npm run perf` (from packages/pirell/core).
//   --counts 1,50,100   call-site counts per scenario (default "1,50,100")
//   --only pipe-shallow-2,direct-op   run a subset of scenarios
//
// Method: writes a generated stress file into perf/ (picked up by the
// package tsconfig), runs `tsc --noEmit --extendedDiagnostics`, parses
// Instantiations/Check time, and reports deltas against a same-imports
// baseline as a Markdown table (paste-ready for Docs/). Errors in the
// stress file itself fail the probe (error paths instantiate different
// types and would pollute the numbers); errors elsewhere are reported and
// ignored, so ablation experiments can run while the library's own
// rejection tests are red. The temp file is removed afterwards, even on
// failure.
//
// Excluded from publishing: `perf/**` is in jsr.json's publish.exclude,
// npm only ships `dist/`, and tsdown's entry is `index.ts`.

import { execFileSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const coreDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const tscBin = join(coreDir, "node_modules", ".bin", "tsc");
const tmpFile = join(coreDir, "perf", "stress.tmp.ts");

const HEAD = [
  'import { pipe, compose } from "../entry/compose.js";',
  'import { double, sumAll, toEntries, entriesToObject, flattenEntries, sumValues, stringifyValues } from "../ops/fixture-ops.js";',
].join("\n");

// Each scenario must typecheck with zero errors at any call count.
//
// Methodology note: tsc caches conditional-type instantiations by type
// arguments, so N *identical* call sites cost ~the first call (growth
// 1.0x = perfect caching, which is good news, not a probe bug). To measure
// true per-call scaling, object-shaped scenarios embed the call index in a
// same-typed extra key (`k${i}`), making each D a distinct type while
// keeping the derived Shape identical. Array data infers to `number[]`
// regardless of values, so array scenarios are inherently cache demos:
// their n=1 column is the cold cost, n=50/n=100 show amortization.
//
// Stability note (tsc 7 native): cold (n=1) and baseline totals vary
// run-to-run with machine load and tree-state churn (file create/delete
// cycles) — swings of ±300 cold / ±4k baseline observed, including
// impossible-looking negatives. The marginal column ((n100-n50)/50) has
// held stable across every run and is the ONLY signal to compare.
// Rules: keep the machine quiet during a run; never create/delete files
// between A/B measurements (edits preserve directory order, create/delete
// may not); compare marginals, ignore cold deltas under a few hundred.
const SCENARIOS: Record<string, (i: string) => string> = {
  // Data-first pipe, shallow branch claim ([["i", number]]). Array data →
  // identical D per call: cold cost + cache behavior.
  "pipe-shallow-2": (i) => `const s${i} = pipe([1,2,3], double, sumAll);`,
  // Data-first pipe, deep shape (["k",["i",number],"..."] -> [["k",number]]
  // -> ["i","i..."]). Distinct D per call via k${i}.
  // NOTE: sumValues' uniform [["k",number]] output cannot feed
  // stringifyValues' bare-mixed ["k..."] input (KindOf leaf-vs-mixed is a
  // deliberate rejection) — so the chain exits through toEntries (bare
  // ["k"] accepts any uniform keyed shape).
  "pipe-deep-2": (i) =>
    `const s${i} = pipe({a:[1,2],b:[3],k${i}:[4]}, sumValues, toEntries);`,
  // Direct op call: no pipe/compose gate, just structural assignability to
  // DataOf<In>. Array data → cache demo.
  "direct-op": (i) => `const s${i} = double()([1,2,3]);`,
  // Direct op call on keyed data, distinct D per call.
  "direct-obj": (i) => `const s${i} = toEntries()({a:1,k${i}:2});`,
  // Raw-fed: prior op's Raw<Out> feeds the next op directly (brand path,
  // no ShapeOf inference on the intermediate value). Array data → cache demo.
  "raw-fed": (i) => `const s${i} = sumAll()(double()([1,2,3]));`,
  // Curried compose with the data gate at the inner call. Array data → cache demo.
  "compose-gated-2": (i) =>
    `const s${i} = compose(double, sumAll)([1,2,3]);`,
  // Longer chain through entry/exit shape changes. Distinct D per call.
  "pipe-chain-4": (i) =>
    `const s${i} = pipe({a:1,b:2,k${i}:3}, toEntries, entriesToObject, toEntries, flattenEntries);`,
  // Heterogeneous values terminate via the mixed path (["k..."]). Distinct
  // D per call via k${i} (boolean keeps the value union heterogeneous).
  "pipe-mixed-1": (i) =>
    `const s${i} = pipe({a:1,b:"x",k${i}:true}, stringifyValues);`,
};

interface Args {
  counts: number[];
  only: Set<string> | null;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { counts: [1, 50, 100], only: null };
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--") continue; // pnpm/npm pass-through separator
    const [flag, inline] = arg.split("=", 2);
    if (flag === "--counts" || flag === "--only") {
      // Accept both `--flag value` and `--flag=value`.
      const value = inline ?? argv[++i];
      if (value === undefined) throw new Error(`${flag} needs a value`);
      if (flag === "--counts") out.counts = value.split(",").map(Number);
      else out.only = new Set(value.split(","));
    } else rest.push(arg);
  }
  if (rest.length > 0) throw new Error(`unknown args: ${rest.join(" ")}`);
  if (out.only)
    for (const name of out.only)
      if (!(name in SCENARIOS)) throw new Error(`unknown scenario: ${name}`);
  if (out.counts.some((n) => !Number.isInteger(n) || n < 1))
    throw new Error("--counts must be positive integers");
  return out;
}

interface Measurement {
  inst: number;
  check: number;
}

function measure(body: string): Measurement {
  writeFileSync(tmpFile, `${HEAD}\n${body}\n`);
  let stdout: string;
  try {
    stdout = execFileSync(tscBin, ["--noEmit", "--extendedDiagnostics"], {
      cwd: coreDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    // tsc exits non-zero on type errors — still inspect output for counts.
    // Only errors in the stress file itself invalidate the measurement
    // (this scoping also lets ablation experiments run while the library's
    // own rejection tests are red; correctness stays vitest/tsc's job).
    const e = err as { stdout?: unknown; stderr?: unknown };
    stdout = String(e.stdout ?? "") + String(e.stderr ?? "");
    const errLines = stdout
      .split("\n")
      .filter((l) => l.includes("stress.tmp.ts") && l.includes("error TS"))
      .slice(0, 5);
    if (errLines.length > 0)
      throw new Error(
        `tsc reported errors in the stress file, measurement invalid:\n${errLines.join("\n")}`,
      );
    // Errors elsewhere (e.g. library rejection tests during an ablation):
    // warn, measure anyway.
    const other = stdout
      .split("\n")
      .filter((l) => l.includes("error TS")).length;
    if (other > 0)
      console.log(`(note: ${other} error(s) outside the stress file — ignored)`);
  }
  const inst = Number(stdout.match(/Instantiations:\s+(\d+)/)?.[1]);
  const check = Number(stdout.match(/Check time:\s+([\d.]+)s/)?.[1]);
  if (!Number.isFinite(inst))
    throw new Error("could not parse tsc --extendedDiagnostics output");
  return { inst, check: Number.isFinite(check) ? check : 0 };
}

const fmt = (n: number): string => n.toLocaleString("en-US");

function main(): void {
  if (!existsSync(tscBin))
    throw new Error(`tsc not found at ${tscBin} — run install first`);
  const { counts, only } = parseArgs(process.argv.slice(2));
  const names = Object.keys(SCENARIOS).filter((n) => !only || only.has(n));
  const version = execFileSync(tscBin, ["--version"], {
    cwd: coreDir,
    encoding: "utf8",
  }).trim();

  try {
    const baseline = measure("// baseline: same imports, zero call sites");
    console.log(
      `Type-cost probe (${version}; baseline ${fmt(baseline.inst)} inst, ${baseline.check}s check)\n`,
    );
    const head =
      `| Scenario | ${counts.map((n) => (n === 1 ? "n=1 (cold)" : `n=${n}`)).join(" | ")} | Growth | Marginal/call |`;
    console.log(head);
    console.log(`|${"---|".repeat(counts.length + 3)}`);
    for (const name of names) {
      const line = SCENARIOS[name]!;
      const results = counts.map((n) =>
        measure(
          Array.from({ length: n }, (_, i) => line(`s${i}`)).join("\n"),
        ),
      );
      const deltas = results.map((r) => r.inst - baseline.inst);
      // Growth + marginal use the two largest counts (steady state, past
      // the n=1 cold cost). Needs ≥2 counts.
      const dLast = deltas.at(-1) ?? 0;
      const dPrev = deltas.length > 1 ? (deltas.at(-2) ?? 0) : 0;
      const nLast = counts.at(-1) ?? 0;
      const nPrev = counts.length > 1 ? (counts.at(-2) ?? 0) : 0;
      const steady =
        deltas.length > 1 && dPrev > 0 && nLast > nPrev
          ? ` | ${(dLast / dPrev).toFixed(2)}× | ~${((dLast - dPrev) / (nLast - nPrev)).toFixed(1)} |`
          : " | — | — |";
      const cells = deltas
        .map((d, k) => `${fmt(d)} (${results[k]!.check}s)`)
        .join(" | ");
      console.log(`| ${name} | ${cells}${steady}`);
    }
  } finally {
    if (existsSync(tmpFile)) rmSync(tmpFile);
  }
}

main();
