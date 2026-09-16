import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DETAIL = process.argv.includes("--detail");

// oxlint exits nonzero when findings exist; the JSON report is still
// on stdout, so capture it from the thrown error.
const bin =
  fileURLToPath(new URL("../node_modules/.bin/oxlint", import.meta.url)) +
  (process.platform === "win32" ? ".cmd" : "");
let raw: string;
try {
  raw = execFileSync(bin, ["--format", "json"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (err: unknown) {
  if (typeof err !== "object" || err === null || !("stdout" in err)) throw err;
  const { stdout } = err;
  if (typeof stdout !== "string") throw err;
  raw = stdout;
}

interface Span {
  line?: number;
  column?: number;
}

interface Diagnostic {
  message: string;
  /** "plugin(rule)", e.g. "typescript(no-unsafe-assignment)". */
  code: string;
  severity: string;
  filename: string;
  labels?: { span?: Span }[];
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- shape is oxlint's documented `--format json` contract ({ diagnostics: [...] })
const { diagnostics } = JSON.parse(raw) as { diagnostics: Diagnostic[] };

/** Inner rule name from "plugin(rule)". */
const ruleName = (code: string): string =>
  code.replace(/^.*\(/, "").replace(/\)$/, "");

interface Group {
  id: string;
  label: string;
  re: RegExp;
}

const GROUP: Group[] = [
  {
    id: "unsafe-any",
    label: "explicit any / unsafe any flow",
    re: /^(no-explicit-any|no-unsafe-)/,
  },
  {
    id: "assertions",
    label: "unsafe or needless type assertions",
    re: /^(no-unsafe-type-assertion|no-unnecessary-type-assertion|consistent-type-assertions)$/,
  },
  {
    id: "dead-code",
    label: "dead code (unused vars/imports)",
    re: /^no-unused-vars$/,
  },
  {
    id: "type-hygiene",
    label: "restricted / redundant types",
    re: /^(no-restricted-types|no-empty-object-type|no-unnecessary-type-constraint|no-unnecessary-type-arguments)$/,
  },
  { id: "style", label: "core + misc best practice", re: /^$/ },
];

const fallbackGroup: Group = {
  id: "style",
  label: "core + misc best practice",
  re: /^$/,
};

const byRule = new Map<string, number>();
const byGroup = new Map<string, number>(
  GROUP.map((g): [string, number] => [g.id, 0]),
);
const byFile = new Map<string, number>();
let total = 0;
let warnings = 0;

for (const diag of diagnostics) {
  if (diag.severity === "warning") warnings++;
  if (diag.severity !== "error") continue;
  total++;
  const rel = diag.filename;
  byFile.set(rel, (byFile.get(rel) ?? 0) + 1);
  const rule = ruleName(diag.code);
  const code = diag.code;
  byRule.set(code, (byRule.get(code) ?? 0) + 1);
  const group = GROUP.find((g) => g.re.test(rule)) ?? fallbackGroup;
  byGroup.set(group.id, (byGroup.get(group.id) ?? 0) + 1);
}

const files = [...byFile.entries()];
const prodFiles = files
  .filter(([f]) => !f.includes(".test.ts"))
  .map(([f]) => f);
const testFiles = files.filter(([f]) => f.includes(".test.ts")).map(([f]) => f);
const prodErrors = prodFiles.reduce((sum, f) => sum + (byFile.get(f) ?? 0), 0);
const testErrors = testFiles.reduce((sum, f) => sum + (byFile.get(f) ?? 0), 0);

console.log(
  `LINT  ${total} errors (${warnings} warnings) in ${files.length} file(s)`,
);
console.log("");
console.log("BY GROUP");
for (const g of GROUP) {
  const n = byGroup.get(g.id) ?? 0;
  if (n) console.log(`  ${String(n).padStart(5)}  ${g.label}`);
}
console.log("");
console.log("BY RULE (count >= 3)");
for (const [rule, n] of [...byRule.entries()]
  .sort((a, b) => b[1] - a[1])
  .filter(([, n]) => n >= 3)) {
  console.log(`  ${String(n).padStart(5)}  ${rule}`);
}
console.log("");
console.log("BY FILE (top 10)");
for (const [file, n] of [...byFile.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)) {
  console.log(`  ${String(n).padStart(5)}  ${file}`);
}
console.log("");
console.log(
  `split: ${prodFiles.length} prod file(s) (${prodErrors} errors), ${testFiles.length} test file(s) (${testErrors} errors)`,
);

if (DETAIL) {
  console.log("");
  console.log("DETAIL");
  let lastFile = "";
  for (const diag of diagnostics) {
    if (diag.severity !== "error") continue;
    if (diag.filename !== lastFile) {
      lastFile = diag.filename;
      console.log("  " + lastFile);
    }
    const span = diag.labels?.[0]?.span;
    console.log(
      `    ${span?.line ?? "?"}:${span?.column ?? "?"}  ${diag.message}  (${diag.code})`,
    );
  }
}

process.exit(total > 0 ? 1 : 0);
