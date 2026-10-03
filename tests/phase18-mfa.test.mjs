import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const provider = read("src/features/auth/AuthProvider.tsx");
const service = read("src/features/auth/mfaService.ts");
const login = read("src/pages/Login.tsx");
const security = read("src/features/auth/AccountSecurity.tsx");
const route = read("src/features/auth/ProtectedRoute.tsx");
const app = read("src/app/App.tsx");
const shell = read("src/components/layout/AppShell.tsx");

assert.match(service, /factorType:\s*"totp"/, "Authenticator enrollment must use TOTP");
assert.match(service, /challengeAndVerify/, "Codes must be challenged and verified by Supabase Auth");
assert.match(service, /getAuthenticatorAssuranceLevel/, "The authenticated session AAL must be checked");
assert.match(service, /factor\.status === "verified"/, "Unfinished factors must never be treated as active authenticators");
assert.match(service, /existing\.all\.filter[\s\S]+item\.status === "unverified"/, "A new login setup must clean up abandoned enrollments");
assert.match(service, /\.unenroll\(/, "Users must be able to remove an authenticator factor");
assert.match(provider, /mfaStatus === "required"/, "Provider must expose a required MFA state");
assert.match(provider, /mfaStatus === "checking" \|\| mfaStatus === "required"/, "Staff data must not load before MFA is resolved");
assert.match(login, /Authenticator verification/i);
assert.match(login, /Set up your authenticator/i, "First-time authenticator enrollment must happen in the login flow");
assert.match(login, /beginMfaEnrollment/, "The login flow must be able to create a TOTP enrollment");
assert.match(login, /Activate and enter CRM/, "Users must verify setup before entering the CRM");
assert.match(login, /autoComplete="one-time-code"/);
assert.match(login, /inputMode="numeric"/);
assert.match(route, /mfaRequired/, "Protected routes must enforce the second factor");
assert.match(route, /mfaStatus === "not_enrolled"/, "Users without an authenticator must remain in the login flow");
assert.match(security, /Authenticator setup QR code/);
assert.match(security, /setup key/i);
assert.match(security, /Future sign-ins will require a one-time code/);
assert.match(app, /path="\/account-security"/);
assert.match(shell, /Authenticator Security/);

console.log("Phase 18 MFA security tests passed");
