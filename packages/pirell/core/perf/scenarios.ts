// Scenario catalog: each entry emits one call-site line and must typecheck
// with zero errors at any count/length. Object scenarios embed the call
// index in a same-typed extra key (`k${i}`) so each D is distinct while the
// derived Shape is identical (tsc caches by type args — identical calls
// would cost ~the first). Array data always infers `number[]`, so those
// stay cache demos; direct calls never reach CheckData (only ComposeGate
// does), so distinct keys don't matter there.

export const HEAD = [
  'import { pipe, compose } from "../entry/compose.js";',
  'import { double, sumAll, toEntries, entriesToObject, flattenEntries, sumValues, stringifyValues } from "../ops/fixture-ops.js";',
].join("\n");

export interface Scenario {
  name: string;
  summary: string;
  /** One call-site line. Fixed-length scenarios ignore `len` (must be ≥1). */
  emit: (i: number, len: number) => string;
  /** Chain length used by the call-count sweep. */
  defaultLen: number;
  /** Whether `len` varies meaningfully (included in the length sweep). */
  sweepLen: boolean;
  /**
   * Whether the length sweep measures one chain instead of N. True for
   * cache-demo scenarios (identical calls collapse to a single chain, so
   * dividing the slope by N would dilute it N×): the slope is the cold
   * single-chain cost per link, NOT per-link-per-call — do not subtract it
   * from distinct-D slopes. Cold noise also hits it undiluted, so expect
   * more run-to-run wobble than distinct-D slopes.
   */
  sweepPerChain: boolean;
}

export const SCENARIOS: Scenario[] = [

  {
    name: "direct-op",
    summary: "Direct op call, no pipe/compose gate. Array data → cache demo.",
    emit: (i) => `const s${i} = double()([1,2,3]);`,
    defaultLen: 1,
    sweepLen: false,
    sweepPerChain: false,
  },
  {
    name: "direct-obj",
    summary: "Direct op call on keyed data, distinct D per call.",
    emit: (i) => `const s${i} = toEntries()({a:1,k${i}:2});`,
    defaultLen: 1,
    sweepLen: false,
    sweepPerChain: false,
  },
  {
    name: "raw-fed",
    summary:
      "Prior op's Raw<Out> feeds the next op directly (no ShapeOf on the intermediate). Array data → cache demo.",
    emit: (i) => `const s${i} = sumAll()(double()([1,2,3]));`,
    defaultLen: 2,
    sweepLen: false,
    sweepPerChain: false,
  },
  {
    name: "pipe-shallow-2",
    summary: "Data-first pipe, shallow branch claim. Array data → cache demo.",
    emit: (i) => `const s${i} = pipe([1,2,3], double, sumAll);`,
    defaultLen: 2,
    sweepLen: false,
    sweepPerChain: false,
  },
  {
    // NOTE: sumValues' uniform [["k",number]] output cannot feed
    // stringifyValues' bare-mixed ["k..."] input (leaf-vs-mixed is a
    // deliberate rejection) — so the chain exits through toEntries (bare
    // ["k"] accepts any uniform keyed shape).
    name: "pipe-deep-2",
    summary: 'Deep shape (["k",["i",number],"..."]). Distinct D per call.',
    emit: (i) =>
      `const s${i} = pipe({a:[1,2],b:[3],k${i}:[4]}, sumValues, toEntries);`,
    defaultLen: 2,
    sweepLen: false,
    sweepPerChain: false,
  },
  {
    name: "compose-gated-2",
    summary:
      "Curried compose with the data gate at the inner call. Array data → cache demo.",
    emit: (i) => `const s${i} = compose(double, sumAll)([1,2,3]);`,
    defaultLen: 2,
    sweepLen: false,
    sweepPerChain: false,
  },
  {
    name: "pipe-chain-4",
    summary:
      "Longer chain through entry/exit shape changes. Distinct D per call.",
    emit: (i) =>
      `const s${i} = pipe({a:1,b:2,k${i}:3}, toEntries, entriesToObject, toEntries, flattenEntries);`,
    defaultLen: 4,
    sweepLen: false,
    sweepPerChain: false,
  },
  {
    name: "pipe-mixed-1",
    summary:
      "Heterogeneous values terminate via the mixed path. Distinct D per call.",
    emit: (i) => `const s${i} = pipe({a:1,b:"x",k${i}:true}, stringifyValues);`,
    defaultLen: 1,
    sweepLen: false,
    sweepPerChain: false,
  },
  {
    name: "pipe-chain-N",
    summary:
      "Length-sweepable chain: toEntries/entriesToObject alternate, valid at any length. Distinct D per call.",
    emit: (i, len) => {
      const links = Array.from({ length: len }, (_, k) =>
        k % 2 === 0 ? "toEntries" : "entriesToObject",
      );
      return `const s${i} = pipe({a:1,b:2,k${i}:3}, ${links.join(", ")});`;
    },
    defaultLen: 4,
    sweepLen: true,
    sweepPerChain: false,
  },
  {
    name: "pipe-sameshape-N",
    summary:
      "Same-shape control: double chained len times (shape never changes link to link — isolates one more Tail frame from shape-nesting cost). Array data → cache demo.",
    emit: (i, len) =>
      `const s${i} = pipe([1,2,3], ${Array.from({ length: len }, () => "double").join(", ")});`,
    defaultLen: 4,
    sweepLen: true,
    sweepPerChain: true,
  },
];

export function findScenario(name: string): Scenario {
  const found = SCENARIOS.find((s) => s.name === name);
  if (!found) throw new Error(`unknown scenario: ${name}`);
  return found;
}

/** Full stress-file content: shared imports plus the generated body. */
export function stressFile(body: string): string {
  return `${HEAD}\n${body}\n`;
}

/** N call sites at the scenario's fixed length (call-count sweep). */
export function countBody(s: Scenario, n: number): string {
  return Array.from({ length: n }, (_, i) => s.emit(i, s.defaultLen)).join(
    "\n",
  );
}

/** N call sites with chain length held at `len` (length sweep). */
export function lengthBody(s: Scenario, n: number, len: number): string {
  return Array.from({ length: n }, (_, i) => s.emit(i, len)).join("\n");
}
