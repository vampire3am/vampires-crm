import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const auth = readFileSync(new URL("../src/features/auth/AuthProvider.tsx", import.meta.url), "utf8");

assert.match(auth, /const identityChanged = activeUserId\.current !== nextUserId/);
assert.match(auth, /else if \(identityChanged\)/);
assert.doesNotMatch(
  auth,
  /onAuthStateChange[\s\S]{0,500}setLoading\(Boolean\(nextSession\)\)/,
  "Background token refreshes must not replace the current workspace with a loading screen",
);
assert.match(auth, /\}, \[session\?\.user\.id\]\);/);

console.log("Auth tab-focus preservation checks passed");