import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const recovery = read("src/core/updateRecovery.ts");
const boundary = read("src/core/error/ErrorBoundary.tsx");
const main = read("src/main.tsx");
const vite = read("vite.config.ts");

assert.match(recovery, /Failed to fetch dynamically imported module/);
assert.match(recovery, /vite:preloadError/);
assert.match(recovery, /RECOVERY_WINDOW_MS/, "Recovery must prevent reload loops");
assert.match(recovery, /searchParams\.set\("crm-refresh"/, "Recovery must bypass a stale HTML cache");
assert.match(boundary, /recoverFromStaleBuild\(error\)/, "The global error boundary must recover missed lazy-load failures");
assert.match(boundary, /forceWorkspaceRefresh/, "The manual recovery button must also bypass stale caches");
assert.match(main, /installStaleBuildRecovery\(\)/, "Recovery must be installed before React renders");
assert.match(vite, /no-cache, no-store, must-revalidate/, "HTML and client routes must not be cached across deployments");
assert.match(vite, /preview:[\s\S]+headers:[\s\S]+no-cache, no-store, must-revalidate/, "The production preview server must enforce fresh deployment responses");

console.log("Phase 19 stale-build recovery checks passed");
