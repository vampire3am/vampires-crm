import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../src/app/App.tsx", import.meta.url), "utf8");

assert.match(app, /sessionStorage\.getItem\(BOOT_LOADER_SESSION_KEY\)/);
assert.match(app, /const showInitialBootLoader = consumeInitialBootLoader\(\)/);
assert.doesNotMatch(
  app,
  /navigation\?\.type\s*===\s*["']reload["']/,
  "The AECS loader must not replay when a tab is restored or reloaded",
);

console.log("Tab-state preservation checks passed");