// Type-cost probe (chain length sweep): deltas as chain length grows,
// call sites held constant. Fixed chains (chain2, deep2) + sweepable
// chains (alternating, same-op). See --help for flags.

import {
  type Scenario,
  alternatingLinks,
  findScenario,
  lengthBody,
  stressFile,
  sweepScenarios,
} from "./scenarios.js";
import {
  assertAndVersion,
  cleanup,
  fmt,
  lengthsHead,
  lengthsRow,
  type Measurement,
  measure,
  parseArgs,
  renderTable,
} from "./utils.js";

const SCENARIOS: Scenario[] = [
  // Sweepable chains only (slopes are the signal). Fixed two-link chains
  // add nothing here — their emit ignores len, so each length compiles
  // the same file three times.
  ...sweepScenarios(
    {
      name: "alternating",
      data: (i) => `{a:1,b:2,k${i}:3}`,
      links: alternatingLinks,
      sweepPerChain: false,
    },
    ["pipe", "wrap"],
  ),
  // Same op repeated, caches to one chain (per-chain slope).
  ...sweepScenarios(
    {
      name: "same-op",
      data: () => "[1,2,3]",
      links: (len) => Array.from({ length: len }, () => "double"),
      sweepPerChain: true,
    },
    ["pipe", "wrap"],
  ),
];

function main(): void {
  const version = assertAndVersion();
  const { only, forms, chainLengths, chainCalls } = parseArgs(
    process.argv.slice(2),
  );
  if (only) for (const name of only) findScenario(SCENARIOS, name);
  const names = SCENARIOS.map((s) => s.name).filter(
    (n) =>
      (!only || only.has(n)) &&
      (!forms || forms.has(n.slice(n.lastIndexOf("-") + 1))),
  );

  try {
    const baseline = measure(
      stressFile("// baseline: same imports, zero call sites"),
    );
    console.log(
      `Type-cost probe — chain length (${version}; baseline ${fmt(baseline.inst)} inst, ${baseline.check}s check)\n`,
    );
    console.log(`Length sweep (call sites held at ${chainCalls}):`);
    const rows: string[][] = [];
    for (const name of names) {
      const s = findScenario(SCENARIOS, name);
      const results: Measurement[] = chainLengths.map((len: number) =>
        measure(stressFile(lengthBody(s, chainCalls, len))),
      );
      const deltas = results.map((r) => r.inst - baseline.inst);
      rows.push(
        lengthsRow(
          s.sweepPerChain ? `${s.name} †` : s.name,
          deltas,
          results.map((r) => r.check),
          chainLengths,
          s.sweepPerChain ? 1 : chainCalls,
          results.map((r) => r.types - baseline.types),
        ),
      );
    }
    if (rows.length > 0)
      console.log(renderTable(lengthsHead(chainLengths, chainCalls), rows));
    const perChain = names
      .map((n) => findScenario(SCENARIOS, n))
      .filter((s) => s.sweepPerChain)
      .map((s) => s.name);
    if (perChain.length > 0)
      console.log(
        `(† ${perChain.join(", ")}: identical calls cache to one chain, so the slope is per-chain (cold) — not per-link-per-call, do not subtract it from distinct-D slopes)`,
      );
  } finally {
    cleanup();
  }
}

main();
