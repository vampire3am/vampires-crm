import { useAuth } from "./AuthProvider";

export function AuthStatus() {
  const { authError, signOut, session } = useAuth();
  if (!authError) return <div className="app-loader" role="status">Connecting securely…</div>;
  return <main className="app-loader">
    <section style={{ maxWidth: 480, padding: 24 }}>
      <h1>Unable to open your workspace</h1>
      <p role="alert">{authError}</p>
      <button className="primary-button" onClick={() => window.location.reload()}>Retry connection</button>
      {session && <button className="secondary-button" onClick={() => void signOut()}>Use another account</button>}
    </section>
  </main>;
}
