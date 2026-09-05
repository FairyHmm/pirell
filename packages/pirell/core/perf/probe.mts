// Type-cost probe: tsc instantiation deltas for synthetic call-site
// matrices, as paste-ready Markdown tables (`npm run perf -- --help`).
// Each scenario compiles in isolation (tsconfig.probe.json, no tests).
//
// Map: scenarios.ts (what) / args.ts (flags) / tsc.ts (measure) /
// report.ts (tables). Orchestration only. `perf/**` is publish-excluded.

import { parseArgs } from "./args.js";
import {
  SCENARIOS,
  countBody,
  findScenario,
  lengthBody,
  stressFile,
} from "./scenarios.js";
import {
  countsHead,
  countsRow,
  fmt,
  lengthsHead,
  lengthsRow,
  renderTable,
} from "./report.js";
import { assertTsc, cleanup, measure, tscVersion } from "./tsc.js";

function main(): void {
  assertTsc();
  const { counts, only, forms, chainLengths, chainCalls } = parseArgs(
    process.argv.slice(2),
  );
  if (only) for (const name of only) findScenario(name); // validates names
  const names = SCENARIOS.map((s) => s.name).filter(
    (n) =>
      (!only || only.has(n)) &&
      (!forms || forms.has(n.slice(n.lastIndexOf("-") + 1))),
  );
  const version = tscVersion();

  try {
    const baseline = measure(
      stressFile("// baseline: same imports, zero call sites"),
    );
    console.log(
      `Type-cost probe (${version}; baseline ${fmt(baseline.inst)} inst, ${baseline.check}s check)\n`,
    );
    const countRows: string[][] = [];
    for (const name of names) {
      const s = findScenario(name);
      const results = counts.map((n) => measure(stressFile(countBody(s, n))));
      const deltas = results.map((r) => r.inst - baseline.inst);
      countRows.push(
        countsRow(
          name,
          deltas,
          results.map((r) => r.check),
          counts,
        ),
      );
    }
    console.log(renderTable(countsHead(counts), countRows));
    if (chainLengths) {
      const sweepable = names.map(findScenario).filter((s) => s.sweepLen);
      console.log(`\nLength sweep (call sites held at ${chainCalls}):`);
      if (sweepable.length === 0)
        console.log("(no length-sweepable scenarios selected)");
      const lengthRows: string[][] = [];
      for (const s of sweepable) {
        const results = chainLengths.map((len) =>
          measure(stressFile(lengthBody(s, chainCalls, len))),
        );
        const deltas = results.map((r) => r.inst - baseline.inst);
        lengthRows.push(
          lengthsRow(
            s.sweepPerChain ? `${s.name} †` : s.name,
            deltas,
            results.map((r) => r.check),
            chainLengths,
            s.sweepPerChain ? 1 : chainCalls,
          ),
        );
      }
      if (lengthRows.length > 0)
        console.log(
          renderTable(lengthsHead(chainLengths, chainCalls), lengthRows),
        );
      const perChain = sweepable
        .filter((s) => s.sweepPerChain)
        .map((s) => s.name);
      if (perChain.length > 0)
        console.log(
          `(† ${perChain.join(", ")}: identical calls cache to one chain, so the slope is per-chain (cold) — not per-link-per-call, do not subtract it from distinct-D slopes)`,
        );
    }
  } finally {
    cleanup();
  }
}

main();
