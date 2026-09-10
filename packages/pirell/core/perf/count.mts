// Type-cost probe (call-site count): tsc instantiation deltas as distinct
// call sites grow. One op per topic — pure per-site cost. See --help
// for flags. `perf/**` is publish-excluded.

import {
  type Scenario,
  type Topic,
  countBody,
  findScenario,
  stressFile,
  topicScenarios,
  wrapChain,
} from "./scenarios.js";
import {
  assertAndVersion,
  cleanup,
  countsHead,
  countsRow,
  fmt,
  measure,
  parseArgs,
  renderTable,
} from "./utils.js";

// Wrap breakdown: pirell-only and pirell+extend prefixes of the -wrap
// chain (the call step is -wrap itself — a separate -call scenario ran
// byte-identical chains, so it measured twice, not more).
function wrapBreakdown(t: Topic): Scenario[] {
  const { name, data, links } = t;
  return [
    {
      name: `${name}-pirell`,
      summary: `pirell(data) only — no extend, no call.`,
      emit: (i) => `const s${i} = pirell(${data(i)});`,
      defaultLen: 1,
      sweepLen: false,
      sweepPerChain: false,
    },
    {
      name: `${name}-extend`,
      summary: `pirell(data).extend({...}) — pirell + extend, no call.`,
      emit: (i) => `const s${i} = pirell(${data(i)}).extend({ ${links[0]} });`,
      defaultLen: 1,
      sweepLen: false,
      sweepPerChain: false,
    },
  ];
}

// Shared-Deferred breakdown: .extend() ONCE, then N downstream .op()
// calls — isolates per-call cost from per-site pirell+extend. Only
// i===0 changes the file's shape (still N real call sites).
function sharedDeferredBreakdown(t: Topic): Scenario {
  const { name, data, links } = t;
  const op = links[0];
  return {
    name: `${name}-wrap`,
    summary: `pirell().extend({...}) ONCE, then N downstream .op() calls (no re-extend).`,
    emit: (i) => {
      const decl =
        i === 0 ? `const shared = pirell().extend({ ${op} });\n` : "";
      return `${decl}const s${i} = shared(${data(i)}).${op}();`;
    },
    defaultLen: 1,
    sweepLen: false,
    sweepPerChain: false,
  };
}

// Stable-type demo: named interface Row, not inline literal — whether
// usage-side stability reaches the freshness floor with no core change.
const STABLE_PREFIX = "interface Row { a: number; k: number; }";

const stableBreakdown: Scenario[] = [
  {
    name: "stable-wrap",
    summary: `Named interface Row (not inline literal) → toEntries.`,
    emit: (i) => {
      const v = `r${i}`;
      return `const ${v}: Row = { a: 1, k: ${i} }; const s${i} = pirell(${v}).extend({ toEntries }).toEntries().value;`;
    },
    defaultLen: 1,
    sweepLen: false,
    sweepPerChain: false,
  },
  {
    name: "stable-pirell",
    summary: `Named interface Row, pirell only.`,
    emit: (i) => {
      const v = `r${i}`;
      return `const ${v}: Row = { a: 1, k: ${i} }; const s${i} = pirell(${v});`;
    },
    defaultLen: 1,
    sweepLen: false,
    sweepPerChain: false,
  },
];

const SCENARIOS: Scenario[] = [
  // arr (array baseline): pipe pins the free form, wrap is the headline.
  // No breakdown — pirell is 0 (cached number[]) and extend is the same
  // +8 constant obj-extend already pins.
  ...topicScenarios(
    {
      name: "arr",
      data: () => "[1,2,3]",
      links: ["double"],
    },
    ["pipe", "wrap"],
  ),
  // Special case (regression pin, not a headline): .extend() hoisted,
  // distinct data(i) per site — only extension shared.
  sharedDeferredBreakdown({
    name: "shared",
    data: (i) => `[1,2,${i}]`,
    links: ["double"],
  }),
  // obj (uniform object headline) + the one full decomposition.
  ...wrapBreakdown({
    name: "obj",
    data: (i) => `{a:1,k${i}:2}`,
    links: ["toEntries"],
  }),
  ...topicScenarios(
    {
      name: "obj",
      data: (i) => `{a:1,k${i}:2}`,
      links: ["toEntries"],
    },
    ["wrap"],
  ),
  // Control (not a headline): 3-key uniform separates key-count effect
  // from mixed-values effect vs objmix.
  ...topicScenarios(
    {
      name: "obj3",
      data: (i) => `{a:1,b:2,k${i}:3}`,
      links: ["toEntries"],
    },
    ["wrap"],
  ),
  // objmix (mixed object headline). No breakdown — same structure as
  // obj's; the wrap marginal carries the comparison.
  ...topicScenarios(
    {
      name: "objmix",
      data: (i) => `{a:1,b:"x",k${i}:true}`,
      links: ["stringifyValues"],
    },
    ["wrap"],
  ),
  // arrmix (heterogeneous array → i...): the one shape kind with no
  // scenario before mixedLength.
  ...topicScenarios(
    {
      name: "arrmix",
      data: (i) => `[1,"x",${i}]`,
      links: ["mixedLength"],
    },
    ["wrap"],
  ),
  // objnest (uniform nested arrays → sumValues' open-tail In): "..."
  // claim coverage in count mode (deep2 covers it in length mode).
  ...topicScenarios(
    {
      name: "objnest",
      data: (i) => `{a:[1,2],b:[3],k${i}:[4]}`,
      links: ["sumValues"],
    },
    ["wrap"],
  ),
  // arrnth (bare-i claim via args): pipe only — direct is structurally
  // zero and Fluent's call type is 0-arg, so arg-taking ops have no
  // wrap form.
  {
    name: "arrnth-pipe",
    summary: `Pipe ([1,2,3], nth(i)) with varying arg.`,
    emit: (i) => `const s${i} = pipe([1,2,3], nth(${i % 3}));`,
    defaultLen: 1,
    sweepLen: false,
    sweepPerChain: false,
  },
  // Recommended usage pattern (not a chain): named types zero the pirell
  // share — the freshness floor, reachable with no core change.
  ...stableBreakdown,
];

function main(): void {
  const version = assertAndVersion();
  const { counts, only, forms } = parseArgs(process.argv.slice(2));
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
      `Type-cost probe — call-site count (${version}; baseline ${fmt(baseline.inst)} inst, ${baseline.check}s check)\n`,
    );
    const rows: string[][] = [];
    for (const name of names) {
      const s = findScenario(SCENARIOS, name);
      const isStable = s.name.startsWith("stable-");
      const body = isStable
        ? `${STABLE_PREFIX}\n${countBody(s, counts[counts.length - 1]!)}`
        : countBody(s, counts[counts.length - 1]!);
      const results = counts.map((n) => {
        const b = isStable
          ? `${STABLE_PREFIX}\n${countBody(s, n)}`
          : countBody(s, n);
        return measure(stressFile(b));
      });
      const deltas = results.map((r) => r.inst - baseline.inst);
      rows.push(
        countsRow(
          name,
          deltas,
          results.map((r) => r.check),
          counts,
          results.map((r) => r.types - baseline.types),
        ),
      );
    }
    console.log(renderTable(countsHead(counts), rows));
  } finally {
    cleanup();
  }
}

main();
