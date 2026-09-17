/**
 * Normalizes `@mdn/browser-compat-data` into three flat tables: the
 * feature dimension, the per-browser support fact, and browser
 * releases. Statement arrays collapse to their first entry; versions
 * stay raw (`true`, `"66"`, `"≤37"`, `null`).
 *
 * @module
 */
import bcd from "@mdn/browser-compat-data";
import type { Identifier, SimpleSupportStatement } from "@mdn/browser-compat-data";

/** One compat node: dotted path plus its status flags. */
export type Feature = {
  path: string;
  category: string;
  experimental: boolean;
  deprecated: boolean;
};

/** One browser's statement on one feature. */
export type Support = {
  path: string;
  browser: string;
  // Nulls normalize out (`added` → `false`, `removed` → `""`): row
  // types with null fields infer mixed shapes, and BCD's own `false`
  // already means "not supported".
  added: string | boolean;
  removed: string;
};

/** One browser release. */
export type Release = {
  browser: string;
  version: string;
  date: string;
  status: string;
};

/** The three normalized tables, plus the sparsest-covered browser. */
export type BcdTables = {
  features: Feature[];
  support: Support[];
  releases: Release[];
  /** Fewest support rows — the honest anti-join target. */
  sparsest: string;
};

// Recursive walk: every child carrying `__compat` is a feature row;
// its support block fans out to one row per browser.
const walk = (
  node: Identifier,
  path: string,
  category: string,
  features: Feature[],
  support: Support[],
): void => {
  for (const [key, child] of Object.entries(node)) {
    if (key === "__compat" || typeof child !== "object" || child === null)
      continue;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- tree children past __compat are Identifiers by BCD schema (statements only hang under __compat)
    const id = child as Identifier;
    const compat = id.__compat;
    const at = `${path}.${key}`;
    if (compat !== undefined) {
      features.push({
        path: at,
        category,
        experimental: compat.status?.experimental === true,
        deprecated: compat.status?.deprecated === true,
      });
      for (const [browser, statement] of Object.entries(
        compat.support ?? {},
      )) {
        const first: SimpleSupportStatement | undefined = Array.isArray(
          statement,
        )
          ? statement[0]
          : statement;
        support.push({
          path: at,
          browser,
          added: first?.version_added ?? false,
          removed: first?.version_removed ?? "",
        });
      }
    }
    walk(id, at, category, features, support);
  }
};

/**
 * Loads and normalizes the whole dataset. Top-level sections (`api`,
 * `css`, …) become categories; `browsers` becomes the releases table.
 */
export const tables = (): BcdTables => {
  const features: Feature[] = [];
  const support: Support[] = [];
  const releases: Release[] = [];
  for (const [category, section] of Object.entries(bcd)) {
    if (category === "__meta" || category === "browsers") continue;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- sections past the two skips are feature trees by BCD schema
    walk(section as Identifier, category, category, features, support);
  }
  const coverage = new Map<string, number>();
  for (const row of support)
    coverage.set(row.browser, (coverage.get(row.browser) ?? 0) + 1);
  let sparsest = "";
  let fewest = features.length;
  for (const [browser, count] of coverage)
    if (count < fewest) {
      sparsest = browser;
      fewest = count;
    }
  for (const [browser, info] of Object.entries(bcd.browsers))
    for (const [version, release] of Object.entries(info.releases ?? {}))
      releases.push({
        browser,
        version,
        date: release.release_date ?? "",
        status: release.status ?? "",
      });
  return { features, support, releases, sparsest };
};
