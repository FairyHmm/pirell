// tsc measurement: writes the stress file, compiles it with
// `tsc -p tsconfig.probe.json` (library without tests — each scenario pays
// its own cold), parses Instantiations/Check time. Stress errors fail the
// run (error paths instantiate different types); library errors warn, so
// ablations still measure while red. Temp file removed afterwards.

import { execFileSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const coreDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const tscBin = join(coreDir, "node_modules", ".bin", "tsc");
const probeConfig = join(coreDir, "tsconfig.probe.json");
const tmpFile = join(coreDir, "perf", "stress.tmp.ts");

export interface Measurement {
  inst: number;
  check: number;
}

export function assertTsc(): void {
  if (!existsSync(tscBin))
    throw new Error(`tsc not found at ${tscBin} — run install first`);
}

export function tscVersion(): string {
  return execFileSync(tscBin, ["--version"], {
    cwd: coreDir,
    encoding: "utf8",
  }).trim();
}

export function measure(fileContent: string): Measurement {
  writeFileSync(tmpFile, fileContent);
  let stdout: string;
  try {
    stdout = execFileSync(
      tscBin,
      ["-p", probeConfig, "--extendedDiagnostics"],
      {
        cwd: coreDir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch (err) {
    // tsc exits non-zero on type errors — still inspect output for counts.
    // Only errors in the stress file itself invalidate the measurement.
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
    // Errors in library sources during an ablation: warn, measure anyway.
    const other = stdout
      .split("\n")
      .filter((l) => l.includes("error TS")).length;
    if (other > 0)
      console.log(
        `(note: ${other} error(s) outside the stress file — ignored)`,
      );
  }
  const inst = Number(stdout.match(/Instantiations:\s+(\d+)/)?.[1]);
  const check = Number(stdout.match(/Check time:\s+([\d.]+)s/)?.[1]);
  if (!Number.isFinite(inst))
    throw new Error("could not parse tsc --extendedDiagnostics output");
  return { inst, check: Number.isFinite(check) ? check : 0 };
}

export function cleanup(): void {
  if (existsSync(tmpFile)) rmSync(tmpFile);
}
