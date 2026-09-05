// CLI parsing for the type-cost probe (see probe.mts for usage).

export interface Args {
  counts: number[];
  only: Set<string> | null;
  forms: Set<string> | null;
  chainLengths: number[] | null;
  chainCalls: number;
}

const USAGE = `Type-cost probe: measures tsc instantiation deltas for synthetic call-site matrices.

Usage: npm run perf [--flags]  (from packages/pirell/core; pnpm/npm need "--" first)
  --counts 1,25,50        call-site counts per scenario (default "1,25,50")
  --only a,b              run a subset of scenarios
  --forms direct,pipe     filter by form (direct, pipe, wrap)
  --chain-lengths 1,4,8   also sweep chain length, holding call sites at --chain-calls
  --chain-calls 60        call sites per length-sweep measurement (default 60)
  -h, --help              print this and exit`;

function parseIntList(value: string, flag: string, min: number): number[] {
  const out = value.split(",").map(Number);
  if (out.some((n) => !Number.isInteger(n) || n < min))
    throw new Error(`${flag} must be comma-separated integers ≥ ${min}`);
  return out;
}

export function parseArgs(argv: string[]): Args {
  const out: Args = {
    counts: [1, 25, 50],
    only: null,
    forms: null,
    chainLengths: null,
    chainCalls: 60,
  };
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--") continue; // pnpm/npm pass-through separator
    if (arg === "-h" || arg === "--help") {
      console.log(USAGE);
      process.exit(0);
    }
    const [flag, inline] = arg.split("=", 2);
    if (
      flag === "--counts" ||
      flag === "--only" ||
      flag === "--forms" ||
      flag === "--chain-lengths" ||
      flag === "--chain-calls"
    ) {
      // Accept both `--flag value` and `--flag=value`.
      const value = inline ?? argv[++i];
      if (value === undefined) throw new Error(`${flag} needs a value`);
      if (flag === "--counts") out.counts = parseIntList(value, flag, 1);
      else if (flag === "--chain-lengths")
        out.chainLengths = parseIntList(value, flag, 1);
      else if (flag === "--chain-calls") {
        const [n] = parseIntList(value, flag, 1);
        out.chainCalls = n!;
      } else if (flag === "--only") out.only = new Set(value.split(","));
      else out.forms = new Set(value.split(","));
    } else rest.push(arg);
  }
  if (rest.length > 0) throw new Error(`unknown args: ${rest.join(" ")}`);
  return out;
}
