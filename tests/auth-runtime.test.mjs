import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import React from "react";
import { act, create } from "react-test-renderer";
import { MemoryRouter } from "react-router-dom";

const require = createRequire(import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.window = { setTimeout, clearTimeout, addEventListener() {}, removeEventListener() {} };

// Execute the actual TSX provider with only its network boundary replaced.
function loadSource(path, mocks = {}) {
  const source = readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(name => mocks[name] ?? require(name), module, module.exports);
  return module.exports;
}
const errors = loadSource("features/auth/authErrors.ts");
const staff = id => ({ id, is_active: true, full_name: "Test Staff", role: "COUNSELLOR" });
const session = id => ({ user: { id } });
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

async function setup(t, overrides = {}) {
  let listener;
  let state;
  let signOutCalls = 0;
  let profileReads = 0;
  let mfaReads = 0;
  let mfaVerifyCalls = 0;
  const client = {
    auth: {
      getSession: overrides.getSession ?? (async () => ({ data: { session: null }, error: null })),
      onAuthStateChange(fn) { listener = fn; return { data: { subscription: { unsubscribe() {} } } }; },
      async signInWithPassword() {
        if (overrides.signInError) return { data: {}, error: overrides.signInError };
        const next = session("one");
        listener("SIGNED_IN", next);
        return { data: { session: next }, error: null };
      },
      async signOut() { signOutCalls++; listener("SIGNED_OUT", null); return { error: null }; },
    },
    from() { return { select() { return { eq(_key, id) { return {
      maybeSingle() { profileReads++; return overrides.profile?.(id) ?? Promise.resolve({ data: staff(id), error: null }); },
    }; } }; } }; },
    rpc: overrides.rpc ?? (async () => ({ data: [{ permission_name: "students.create" }], error: null })),
  };
  const provider = loadSource("features/auth/AuthProvider.tsx", {
    "../../lib/supabase": { isSupabaseConfigured: true, supabase: client }, "./authErrors": errors,
    "./mfaService": {
      readMfaState: async () => overrides.mfaState?.(++mfaReads) ?? ({ factors: [], currentLevel: "aal1", requiresChallenge: false }),
      verifyMfaFactor: async (factorId, code) => { mfaVerifyCalls++; return overrides.verifyMfa?.(factorId, code); },
    },
  });
  function Probe() { state = provider.useAuth(); return null; }
  let tree;
  await act(async () => { tree = create(React.createElement(provider.AuthProvider, null, React.createElement(Probe))); });
  t.after(async () => { await act(async () => tree.unmount()); });
  return { get state() { return state; }, get signOutCalls() { return signOutCalls; }, get profileReads() { return profileReads; }, get mfaVerifyCalls() { return mfaVerifyCalls; },
    async emit(next) { await act(async () => listener("SIGNED_IN", next)); },
  };
}

test("valid login loads staff and permissions; repeated sign-in does not strand loading", async t => {
  const h = await setup(t);
  await act(async () => h.state.signIn("staff@example.com", "test-only"));
  assert.equal(h.state.profile.id, "one");
  assert.equal(h.state.loading, false);
  assert.equal(h.state.hasPermission("students.create"), true);
  await act(async () => h.state.signIn("staff@example.com", "test-only"));
  assert.equal(h.state.loading, false);
  assert.equal(h.profileReads, 1);
});

test("verified authenticator blocks staff data until the second factor succeeds", async t => {
  const factor = { id: "totp-one", factor_type: "totp", status: "verified", friendly_name: "Work phone" };
  const h = await setup(t, {
    mfaState: read => ({ factors: [factor], currentLevel: read === 1 ? "aal1" : "aal2", requiresChallenge: read === 1 }),
  });
  await h.emit(session("one"));
  assert.equal(h.state.mfaRequired, true);
  assert.equal(h.state.profile, null);
  assert.equal(h.profileReads, 0);
  await act(async () => h.state.verifyMfa("123456"));
  assert.equal(h.mfaVerifyCalls, 1);
  assert.equal(h.state.mfaRequired, false);
  assert.equal(h.state.profile.id, "one");
});

test("late session restoration cannot overwrite a newer successful login", async t => {
  const restore = deferred();
  const h = await setup(t, { getSession: () => restore.promise });
  await h.emit(session("one"));
  await act(async () => restore.resolve({ data: { session: null }, error: null }));
  assert.equal(h.state.session.user.id, "one");
  assert.equal(h.state.profile.id, "one");
  assert.equal(h.state.loading, false);
});

test("profile query failure is visible and does not silently sign out", async t => {
  const h = await setup(t, { profile: async () => ({ data: null, error: { message: "network failure" } }) });
  await h.emit(session("one"));
  assert.match(h.state.authError, /profile could not be loaded/);
  assert.equal(h.state.profile, null);
  assert.equal(h.state.loading, false);
  assert.equal(h.signOutCalls, 0);
});

test("missing and inactive staff are blocked with actionable errors", async t => {
  const h = await setup(t, { profile: async id => ({ data: id === "missing" ? null : { ...staff(id), is_active: false }, error: null }) });
  await h.emit(session("missing"));
  assert.match(h.state.authError, /no staff profile/);
  await h.emit(session("inactive"));
  assert.match(h.state.authError, /inactive/);
  assert.equal(h.state.profile, null);
  assert.deepEqual(h.state.effectivePermissions, []);
});

test("rejected permission request stops loading and fails closed", async t => {
  const h = await setup(t, { rpc: async () => { throw new Error("Connection lost"); } });
  await h.emit(session("one"));
  assert.equal(h.state.loading, false);
  assert.equal(h.state.profile, null);
  assert.match(h.state.authError, /Connection lost/);
  assert.equal(h.state.hasPermission("students.create"), false);
});

test("late permission response for old identity cannot authorize a new identity", async t => {
  const pending = deferred();
  let calls = 0;
  const h = await setup(t, { rpc: () => ++calls === 1 ? pending.promise : Promise.resolve({ data: [], error: null }) });
  await h.emit(session("one"));
  await h.emit(session("two"));
  await act(async () => pending.resolve({ data: [{ permission_name: "admin" }], error: null }));
  assert.equal(h.state.profile.id, "two");
  assert.deepEqual(h.state.effectivePermissions, []);
});

test("restoration rejection clears spinner and reports the error", async t => {
  const h = await setup(t, { getSession: async () => { throw new Error("restore failed"); } });
  assert.equal(h.state.loading, false);
  assert.match(h.state.authError, /restore your session/);
});

test("credential errors remain distinct from network and service failures", async t => {
  assert.match(errors.signInError({ code: "invalid_credentials" }), /Invalid staff email or password/);
  assert.match(errors.signInError({ code: "email_not_confirmed" }), /not confirmed/);
  assert.match(errors.signInError({ status: 429 }), /Too many/);
  const h = await setup(t, { signInError: { status: 503 } });
  await act(async () => assert.rejects(h.state.signIn("staff@example.com", "test-only"), /authentication service/));
  assert.equal(h.state.session, null);
});

test("stalled account requests time out and successful requests settle normally", async () => {
  await assert.rejects(errors.withAuthTimeout(new Promise(() => {}), "Request timed out", 5), /timed out/);
  assert.equal(await errors.withAuthTimeout(Promise.resolve("ok"), "timeout", 5), "ok");
});

test("staff access errors distinguish schema, policy, and session failures", () => {
  assert.match(errors.staffAccessError({ code: "42P17" }, "profile"), /recursion/);
  assert.match(errors.staffAccessError({ code: "42501" }, "profile"), /denied access/);
  assert.match(errors.staffAccessError({ code: "PGRST205" }, "profile"), /migrations/);
  assert.match(errors.staffAccessError({ code: "PGRST202" }, "permissions"), /migrations/);
  assert.match(errors.staffAccessError({ code: "PGRST301" }, "profile"), /session was rejected/);
});

test("expired database session refreshes once and retries the staff read", async () => {
  let reads = 0;
  let refreshes = 0;
  const result = await errors.recoverStaffRead(
    async () => ++reads === 1 ? { error: { code: "PGRST303", message: "JWT expired" } } : { error: null, data: "staff" },
    async () => { refreshes++; }, () => true,
  );
  assert.equal(result.data, "staff");
  assert.equal(reads, 2);
  assert.equal(refreshes, 1);
});

test("future-issued token retries with the same session for up to 90 seconds", async () => {
  let reads = 0;
  const waits = [];
  const result = await errors.recoverStaffRead(
    async () => { reads++; return { error: { code: "PGRST303", message: "JWT issued at future" } }; },
    async () => assert.fail("Must not keep issuing newer tokens"), () => true,
    async delay => { waits.push(delay); },
  );
  assert.equal(result.error.code, "PGRST303");
  assert.deepEqual(waits, [1000, 2000, 4000, 8000, 15000, 30000, 30000]);
  assert.equal(reads, 8);
});

test("persistent JWT rejection does not cause an infinite refresh loop", async () => {
  let refreshes = 0;
  const result = await errors.recoverStaffRead(
    async () => ({ error: { code: "PGRST301", message: "Invalid JWT" } }),
    async () => { refreshes++; }, () => true,
  );
  assert.equal(refreshes, 1);
  assert.equal(result.error.code, "PGRST301");
});

test("permission errors do not refresh and account switches cancel recovery", async () => {
  await errors.recoverStaffRead(async () => ({ error: { code: "42501" } }), async () => assert.fail(), () => true);
  let current = true;
  let reads = 0;
  await assert.rejects(errors.recoverStaffRead(
    async () => { reads++; return { error: { code: "PGRST303", message: "JWT issued at future" } }; },
    async () => assert.fail(), () => current, async () => { current = false; },
  ), /Account changed/);
  assert.equal(reads, 1);
});

test("protected routes require both a session, MFA, and a validated staff profile", async () => {
  let auth = { session: session("one"), profile: null, loading: false, authError: "Staff profile unavailable", mfaStatus: "verified", mfaRequired: false };
  const { ProtectedRoute } = loadSource("features/auth/ProtectedRoute.tsx", {
    "./AuthProvider": { useAuth: () => auth },
    "./AuthStatus": { AuthStatus: () => React.createElement("p", null, "Account check failed") },
    "react-router-dom": { Navigate: () => React.createElement("p", null, "Login"), Outlet: () => React.createElement("p", null, "Private CRM") },
  });
  let tree;
  const render = () => React.createElement(MemoryRouter, null, React.createElement(ProtectedRoute));
  await act(async () => { tree = create(render()); });
  assert.match(JSON.stringify(tree.toJSON()), /Account check failed/);
  auth = { ...auth, authError: "" };
  await act(async () => tree.update(render()));
  assert.match(JSON.stringify(tree.toJSON()), /Login/);
  auth = { ...auth, profile: staff("one") };
  await act(async () => tree.update(render()));
  assert.match(JSON.stringify(tree.toJSON()), /Private CRM/);
  auth = { ...auth, mfaStatus: "required", mfaRequired: true };
  await act(async () => tree.update(render()));
  assert.match(JSON.stringify(tree.toJSON()), /Login/);
  await act(async () => tree.unmount());
});
