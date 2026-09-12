// Scenario helpers: emit functions, stress-file header, body builders.
// The catalog (which topics) lives in the using script — count.mts for
// per-site cost, length.mts for chain length sweep.

export const HEAD = [
  'import { pipe, compose } from "../entry/compose.js";',
  'import { pirell } from "../entry/assemble.js";',
  'import { double, sumAll, toEntries, entriesToObject, flattenEntries, sumValues, stringifyValues, mixedLength, nth } from "../ops/fixture-ops.js";',
].join("\n");

export interface Scenario {
  name: string;
  summary: string;
  emit: (i: number, len: number) => string;
  defaultLen: number;
  sweepLen: boolean;
  /** True = identical calls cache to one chain (slope is per-chain, not per-link-per-call). */
  sweepPerChain: boolean;
}

export interface Topic {
  name: string;
  data: (i: number) => string;
  links: string[];
}

export interface SweepTopic {
  name: string;
  data: (i: number) => string;
  links: (len: number) => string[];
  sweepPerChain: boolean;
}

export type Form = "direct" | "pipe" | "wrap";

export function topicScenarios(
  t: Topic,
  forms: Form[] = ["direct", "pipe", "wrap"],
): Scenario[] {
  const { name, data, links } = t;
  const out: Scenario[] = [];
  if (forms.includes("direct"))
    out.push({
      name: `${name}-direct`,
      summary: `Direct ${links.join("→")}.`,
      emit: (i) => `const s${i} = ${directChain(data(i), links)};`,
      defaultLen: links.length,
      sweepLen: false,
      sweepPerChain: false,
    });
  if (forms.includes("pipe"))
    out.push({
      name: `${name}-pipe`,
      summary: `Pipe ${links.join("→")}.`,
      emit: (i) => `const s${i} = pipe(${data(i)}, ${links.join(", ")});`,
      defaultLen: links.length,
      sweepLen: false,
      sweepPerChain: false,
    });
  if (forms.includes("wrap"))
    out.push({
      name: `${name}-wrap`,
      summary: `Wrap ${links.join("→")} via pirell Fluent.`,
      emit: (i) => wrapChain(i, data(i), links),
      defaultLen: links.length,
      sweepLen: false,
      sweepPerChain: false,
    });
  return out;
}

export function sweepScenarios(
  t: SweepTopic,
  forms: Form[] = ["direct", "pipe", "wrap"],
): Scenario[] {
  const { name, data, links, sweepPerChain } = t;
  const out: Scenario[] = [];
  if (forms.includes("direct"))
    out.push({
      name: `${name}-direct`,
      summary: `Direct length-sweepable chain.`,
      emit: (i, len) => `const s${i} = ${directChain(data(i), links(len))};`,
      defaultLen: 4,
      sweepLen: true,
      sweepPerChain,
    });
  if (forms.includes("pipe"))
    out.push({
      name: `${name}-pipe`,
      summary: `Pipe length-sweepable chain.`,
      emit: (i, len) =>
        `const s${i} = pipe(${data(i)}, ${links(len).join(", ")});`,
      defaultLen: 4,
      sweepLen: true,
      sweepPerChain,
    });
  if (forms.includes("wrap"))
    out.push({
      name: `${name}-wrap`,
      summary: `Wrap length-sweepable chain.`,
      emit: (i, len) => wrapChain(i, data(i), links(len)),
      defaultLen: 4,
      sweepLen: true,
      sweepPerChain,
    });
  return out;
}

export function findScenario(
  scenarios: Scenario[],
  name: string,
): Scenario {
  const found = scenarios.find((s) => s.name === name);
  if (!found) throw new Error(`unknown scenario: ${name}`);
  return found;
}

export function directChain(data: string, links: string[]): string {
  let expr = data;
  for (const l of links) expr = `${l}()(${expr})`;
  return expr;
}

export function wrapChain(i: number, data: string, links: string[]): string {
  // Chain off the previous *surface*, never a fresh pirell(prev.value):
  // re-wrapping loses the prior op's declared Out (bare-literal ShapeOf
  // can't reconstruct it) and valid links mismatch bogusly.
  const lines: string[] = [];
  let cur = `pirell(${data})`;
  links.forEach((l, k) => {
    const v = k === links.length - 1 ? `s${i}` : `s${i}_${k}`;
    lines.push(`const ${v} = ${cur}.extend({ ${l} }).${l}();`);
    cur = v;
  });
  return lines.join("\n");
}

export function alternatingLinks(len: number): string[] {
  return Array.from({ length: len }, (_, k) =>
    k % 2 === 0 ? "toEntries" : "entriesToObject",
  );
}

export function stressFile(body: string): string {
  return `${HEAD}\n${body}\n`;
}

export function countBody(s: Scenario, n: number): string {
  return Array.from({ length: n }, (_, i) => s.emit(i, s.defaultLen)).join(
    "\n",
  );
}

export function lengthBody(s: Scenario, n: number, len: number): string {
  return Array.from({ length: n }, (_, i) => s.emit(i, len)).join("\n");
}
