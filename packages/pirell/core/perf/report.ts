// Markdown tables (constant-width) for the probe. Stability (tsc 7):
// marginals are the signal — totals repeat back-to-back byte-identically.
// Colds wobble ±300 with load/tree churn: quiet machine, no create/delete
// between A/B, ignore cold deltas under a few hundred. Length slopes are
// concave — pass ≥3 lengths, read the last interval.

export const fmt = (n: number): string => n.toLocaleString("en-US");

// Tables render constant-width: callers collect head + all rows first,
// then renderTable pads every column to its widest cell, so pasted output
// stays aligned without manual cleanup. A cell may hold two parts joined
// by "\t" (count cells do: "1,897\t(80ms)"): the left part aligns left,
// the right part aligns right, so inst counts form one flush edge and
// times form another within the same column.
export function renderTable(head: string[], rows: string[][]): string {
  const split = (c: string): [string, string] => {
    const i = c.indexOf("\t");
    return i < 0 ? [c, ""] : [c.slice(0, i), c.slice(i + 1)];
  };
  const widths = head.map((h, i) => {
    const parts = rows.map((r) => split(r[i] ?? ""));
    const leftW = Math.max(...parts.map((p) => p[0].length));
    const rightW = Math.max(...parts.map((p) => p[1].length));
    return Math.max(h.length, leftW + (rightW > 0 ? 1 + rightW : 0), 3);
  });
  const cell = (c: string, i: number): string => {
    const total = widths[i]!;
    const [left, right] = split(c);
    if (!right) return left.padEnd(total);
    const rightW = total - left.length - 1;
    return `${left} ${right.padStart(Math.max(right.length, rightW))}`;
  };
  const line = (cells: string[]): string =>
    `| ${cells.map((c, i) => cell(c, i)).join(" | ")} |`;
  const divider = `|${widths.map((w) => "-".repeat(w + 2)).join("|")}|`;
  return [line(head), divider, ...rows.map(line)].join("\n");
}

// One count cell: inst count (aligns left) + check time in ms (aligns right).
const countCell = (inst: number, checkSecs: number): string =>
  `${fmt(inst)} \t ${Math.round(checkSecs * 1000)}ms`;

export function countsHead(counts: number[]): string[] {
  return [
    "Scenario",
    ...counts.map((n) => (n === 1 ? "n=1 (cold)" : `n=${n}`)),
    "Growth",
    "Marginal",
  ];
}

export function countsRow(
  name: string,
  deltas: number[],
  checks: number[],
  counts: number[],
): string[] {
  // Growth + marginal use the two largest counts (steady state, past
  // the n=1 cold cost). Needs ≥2 counts.
  const dLast = deltas.at(-1) ?? 0;
  const dPrev = deltas.length > 1 ? (deltas.at(-2) ?? 0) : 0;
  const nLast = counts.at(-1) ?? 0;
  const nPrev = counts.length > 1 ? (counts.at(-2) ?? 0) : 0;
  const steady =
    deltas.length > 1 && dPrev > 0 && nLast > nPrev
      ? [
          `${(dLast / dPrev).toFixed(2)}×`,
          `~${((dLast - dPrev) / (nLast - nPrev)).toFixed(1)}`,
        ]
      : ["—", "—"];
  return [name, ...deltas.map((d, k) => countCell(d, checks[k]!)), ...steady];
}

export function lengthsHead(lengths: number[], calls: number): string[] {
  return [
    `Scenario (${calls} calls)`,
    ...lengths.map((l) => `len=${l}`),
    "Marginal",
  ];
}

export function lengthsRow(
  name: string,
  deltas: number[],
  checks: number[],
  lengths: number[],
  divisor: number,
): string[] {
  // Per-link slope across the two longest chains. Distinct-D scenarios
  // pass calls as the divisor (one chain's per-link cost); per-chain
  // scenarios pass 1 (see Scenario.sweepPerChain). Needs ≥2 lengths.
  const dLast = deltas.at(-1) ?? 0;
  const dPrev = deltas.length > 1 ? (deltas.at(-2) ?? 0) : 0;
  const lLast = lengths.at(-1) ?? 0;
  const lPrev = lengths.length > 1 ? (lengths.at(-2) ?? 0) : 0;
  const steady =
    deltas.length > 1 && lLast > lPrev
      ? `~${((dLast - dPrev) / ((lLast - lPrev) * divisor)).toFixed(2)}`
      : "—";
  return [name, ...deltas.map((d, k) => countCell(d, checks[k]!)), steady];
}
