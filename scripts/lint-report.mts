import { ESLint } from "eslint";

const DETAIL = process.argv.includes("--detail");

const eslint = new ESLint();
const results = await eslint.lintFiles(["**/*.{ts,mts,mjs}"]);

interface Group {
  id: string;
  label: string;
  re: RegExp;
}

const GROUP: Group[] = [
  {
    id: "unsafe-any",
    label: "explicit any / unsafe any flow",
    re: /^@typescript-eslint\/(no-explicit-any|no-unsafe-)/,
  },
  {
    id: "assertions",
    label: "unsafe or needless type assertions",
    re: /^@typescript-eslint\/(no-unsafe-type-assertion|no-unnecessary-type-assertion|consistent-type-assertions)/,
  },
  {
    id: "dead-code",
    label: "dead code (unused vars/imports)",
    re: /(^@typescript-eslint\/no-unused-vars$|^sonarjs\/no-dead-store$|^sonarjs\/no-unused-collection$)/,
  },
  {
    id: "type-hygiene",
    label: "ban-types / redundant constraints",
    re: /^@typescript-eslint\/(ban-types|no-empty-object-type|no-unnecessary-type-constraint|no-unnecessary-type-arguments)/,
  },
  { id: "sonarjs", label: "sonarjs smell rules", re: /^sonarjs\// },
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
let fixable = 0;

for (const res of results) {
  if (res.errorCount === 0 && res.warningCount === 0) continue;
  const rel = res.filePath.replace(process.cwd() + "/", "");
  byFile.set(rel, (byFile.get(rel) ?? 0) + res.errorCount);
  for (const msg of res.messages) {
    if (msg.severity !== 2) continue;
    total++;
    if (msg.fix !== undefined) fixable++;
    const rule = msg.ruleId ?? "(parse)";
    byRule.set(rule, (byRule.get(rule) ?? 0) + 1);
    const group = GROUP.find((g) => g.re.test(rule)) ?? fallbackGroup;
    byGroup.set(group.id, (byGroup.get(group.id) ?? 0) + 1);
  }
}

const files = [...byFile.entries()];
const prodFiles = files
  .filter(([f]) => !f.includes(".test.ts") && !f.startsWith("eslint.config"))
  .map(([f]) => f);
const testFiles = files.filter(([f]) => f.includes(".test.ts")).map(([f]) => f);
const prodErrors = prodFiles.reduce((sum, f) => sum + (byFile.get(f) ?? 0), 0);
const testErrors = testFiles.reduce((sum, f) => sum + (byFile.get(f) ?? 0), 0);

console.log(
  `LINT  ${total} errors in ${files.length} file(s) — ${fixable} fixable`,
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
  for (const res of results) {
    if (res.errorCount === 0) continue;
    console.log("  " + res.filePath.replace(process.cwd() + "/", ""));
    for (const msg of res.messages) {
      if (msg.severity !== 2) continue;
      console.log(
        `    ${msg.line}:${msg.column}  ${msg.message}  (${msg.ruleId ?? "parse"})`,
      );
    }
  }
}

process.exit(total > 0 ? 1 : 0);
