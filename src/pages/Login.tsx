import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldAlert } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthProvider";
import { isSupabaseConfigured } from "../lib/supabase";

export function Login() {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to="/dashboard" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Please provide both your official work email and security password.");
      setBusy(false);
      return;
    }
    try {
      await signIn(email, password);
      navigate("/dashboard");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication failed. Please verify your staff credentials.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-portal-wrapper">
      <section className="login-card-container" aria-label="AECS staff sign in">
        <div className="login-brand-pane">
          <img className="login-hero-image" src="/aecs-login-team.png" alt="Education consultancy team collaborating" />
          <div className="login-hero-shade" />
          <div className="login-hero-copy">
            <p>AECS OPERATIONS</p>
            <h1>Manage Every<br />Student Journey<br />with Clarity</h1>
            <span>One secure workspace for counselling, admissions, applications, documents, classes and operations.</span>
          </div>
        </div>

        <div className="login-form-pane">
          <div className="login-form-shell">
            <div className="login-brand-crest">
              <div className="login-logo-box"><img src="/abroad-logo-new.png" alt="AECS logo" /></div>
              <div className="login-brand-text"><strong>Abroad Education</strong><span>Consultancy Services</span></div>
            </div>

            <header className="login-form-header">
              <h2>Welcome Back</h2>
              <p>Enter your authorized staff credentials to continue.</p>
            </header>

            {!isSupabaseConfigured && <div className="login-error-banner" role="alert"><ShieldAlert size={16} /><span>Authentication service is unavailable.</span></div>}

            <form onSubmit={submit} noValidate>
              <div className="login-field-group">
                <label htmlFor="staff-email">Email Address</label>
                <div className="login-input-wrapper">
                  <Mail size={16} className="login-input-icon" />
                  <input id="staff-email" type="email" className="login-text-input" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@aecsnepal.com" autoComplete="email" required />
                </div>
              </div>

              <div className="login-field-group">
                <label htmlFor="staff-password">Password</label>
                <div className="login-input-wrapper">
                  <Lock size={16} className="login-input-icon" />
                  <input id="staff-password" type={showPassword ? "text" : "password"} className="login-text-input" value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" required />
                  <button type="button" className="login-toggle-eye-btn" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </div>

              <div className="login-form-options">
                <label className="login-remember"><input type="checkbox" checked={rememberMe} onChange={event => setRememberMe(event.target.checked)} /><span>Remember me</span></label>
                <span className="login-help-text">Forgot password? Contact your administrator.</span>
              </div>

              {error && <div className="login-error-banner" role="alert"><ShieldAlert size={16} /><span>{error}</span></div>}

              <button type="submit" className="login-submit-btn" disabled={busy || !isSupabaseConfigured}>
                <span>{busy ? "Signing in…" : "Sign In"}</span>{!busy && <ArrowRight size={16} />}
              </button>
            </form>

            <footer className="login-access-note"><span>Authorized AECS staff access only</span><strong>Secure CRM Workspace</strong></footer>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Login;
