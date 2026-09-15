import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import sonarjs from "eslint-plugin-sonarjs";

export default defineConfig(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "site/**",
      "packages/bundlers/**",
      "**/*.d.ts",
      "**/pnpm-lock.yaml",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  sonarjs.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // ── any / unsafe types ──────────────────────────────────────
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-type-assertion": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",

      // ── code quality ───────────────────────────────────────────
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/no-floating-promises": "off", // not a lib concern

      // ── bloat / smell ──────────────────────────────────────────
      "max-lines": [
        "error",
        { max: 300, skipBlankLines: true, skipComments: true },
      ],
      "max-params": ["error", 6],
      "max-depth": ["error", 5],

      // ── sonarjs tuned ──────────────────────────────────────────
      "sonarjs/cognitive-complexity": ["error", 25],
      "sonarjs/no-duplicate-string": "off", // shapes repeat by design
      "sonarjs/no-identical-functions": "error",
      "sonarjs/no-dead-store": "error",

      // ── eslint core extras ─────────────────────────────────────
      eqeqeq: ["error", "always"],
      "no-else-return": "error",
      "prefer-const": "error",
    },
  },
);
