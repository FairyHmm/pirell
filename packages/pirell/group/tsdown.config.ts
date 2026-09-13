import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  target: "es2023",
  exports: true,
});
