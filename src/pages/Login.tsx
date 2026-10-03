import { ArrowRight, Eye, EyeOff, KeyRound, Loader2, Lock, Mail, ShieldAlert, ShieldCheck, Smartphone } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { AuthStatus } from "../features/auth/AuthStatus";
import { useAuth } from "../features/auth/AuthProvider";
import { beginMfaEnrollment, removeMfaFactor, verifyMfaFactor, type MfaEnrollment } from "../features/auth/mfaService";
import { isSupabaseConfigured } from "../lib/supabase";

export function Login() {
  const { session, profile, loading, authError, mfaStatus, mfaRequired, mfaFactors, signIn, signOut, verifyMfa, refreshMfa } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);

  if (loading || (session && mfaStatus === "checking")) return <AuthStatus />;
  if (session && mfaStatus === "not_enrolled") {
    const beginEnrollment = async () => {
      setBusy(true);
      setError("");
      try {
        setEnrollment(await beginMfaEnrollment("Login authenticator"));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to start authenticator setup.");
      } finally {
        setBusy(false);
      }
    };

    const activateEnrollment = async (event: FormEvent) => {
      event.preventDefault();
      if (!enrollment) return;
      setBusy(true);
      setError("");
      try {
        await verifyMfaFactor(enrollment.id, mfaCode);
        await refreshMfa();
        setEnrollment(null);
        setMfaCode("");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to verify this authenticator.");
      } finally {
        setBusy(false);
      }
    };

    const useAnotherAccount = async () => {
      setBusy(true);
      try {
        if (enrollment) await removeMfaFactor(enrollment.id);
      } catch {
        // Signing out still safely abandons this authenticated setup session.
      } finally {
        await signOut();
        setBusy(false);
      }
    };

    return (
      <main className="login-portal-wrapper">
        <section className="mfa-login-setup-card" aria-label="Set up two-factor authentication">
          <div className="mfa-challenge-icon"><Smartphone size={28} /></div>
          <p className="mfa-eyebrow">REQUIRED ACCOUNT PROTECTION</p>
          <h1>Set up your authenticator</h1>
          <p>Before entering the CRM, connect Google Authenticator, Microsoft Authenticator, Authy, or another TOTP app for <strong>{session.user.email}</strong>.</p>

          {!enrollment ? (
            <div className="mfa-login-intro">
              <div><ShieldCheck size={18} /><span>Your password has been accepted. The next step protects this staff account with a changing 6-digit code.</span></div>
              {error && <div className="login-error-banner" role="alert"><ShieldAlert size={16} /><span>{error}</span></div>}
              <button type="button" className="login-submit-btn" onClick={() => void beginEnrollment()} disabled={busy}>
                <span>{busy ? "Preparing setup…" : "Set up authenticator"}</span>{busy ? <Loader2 className="spin" size={16} /> : <ArrowRight size={16} />}
              </button>
            </div>
          ) : (
            <>
              <div className="mfa-enrollment-copy"><span>STEP 1</span><h2>Scan this QR code</h2><p>Open your authenticator app, add an account, and scan this code.</p></div>
              <div className="mfa-setup-grid mfa-login-setup-grid">
                <img className="mfa-qr-code" src={enrollment.qrCode} alt="Authenticator setup QR code" />
                <div className="mfa-manual-setup">
                  <label htmlFor="login-mfa-secret">Cannot scan? Enter this setup key</label>
                  <input id="login-mfa-secret" value={enrollment.secret} readOnly onFocus={event => event.currentTarget.select()} />
                  <small>Account: {session.user.email}<br />Type: Time based (TOTP)</small>
                </div>
              </div>
              <form onSubmit={activateEnrollment} className="mfa-login-activate-form">
                <label htmlFor="login-mfa-activation-code">STEP 2 · Enter the current 6-digit code</label>
                <input id="login-mfa-activation-code" className="mfa-code-input" value={mfaCode} onChange={event => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" placeholder="000000" autoFocus required />
                {error && <div className="login-error-banner" role="alert"><ShieldAlert size={16} /><span>{error}</span></div>}
                <button type="submit" className="login-submit-btn" disabled={busy || mfaCode.length !== 6}>
                  <span>{busy ? "Activating…" : "Activate and enter CRM"}</span>{busy ? <Loader2 className="spin" size={16} /> : <ArrowRight size={16} />}
                </button>
              </form>
            </>
          )}
          <button type="button" className="mfa-use-another" onClick={() => void useAnotherAccount()} disabled={busy}>Use another account</button>
        </section>
      </main>
    );
  }
  if (session && mfaRequired) {
    const submitMfa = async (event: FormEvent) => {
      event.preventDefault();
      setBusy(true);
      setError("");
      try {
        await verifyMfa(mfaCode);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Authenticator verification failed.");
      } finally {
        setBusy(false);
      }
    };
    return (
      <main className="login-portal-wrapper">
        <section className="mfa-challenge-card" aria-label="Two-factor authentication">
          <div className="mfa-challenge-icon"><KeyRound size={28} /></div>
          <p className="mfa-eyebrow">TWO-FACTOR AUTHENTICATION</p>
          <h1>Authenticator verification</h1>
          <p>Open your authenticator app and enter the current 6-digit code for <strong>{mfaFactors[0]?.friendly_name || "AECS CRM"}</strong>.</p>
          <form onSubmit={submitMfa}>
            <label htmlFor="mfa-code">One-time code</label>
            <input
              id="mfa-code"
              className="mfa-code-input"
              value={mfaCode}
              onChange={event => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              placeholder="000000"
              autoFocus
              required
            />
            {error && <div className="login-error-banner" role="alert"><ShieldAlert size={16} /><span>{error}</span></div>}
            <button type="submit" className="login-submit-btn" disabled={busy || mfaCode.length !== 6}>
              <span>{busy ? "Verifying…" : "Verify and enter CRM"}</span>{!busy && <ArrowRight size={16} />}
            </button>
          </form>
          <button type="button" className="mfa-use-another" onClick={() => void signOut()}>Use another account</button>
        </section>
      </main>
    );
  }
  if (session && (!profile || authError)) return <AuthStatus />;
  if (session && profile) return <Navigate to="/dashboard" replace />;

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

              {(error || authError) && <div className="login-error-banner" role="alert"><ShieldAlert size={16} /><span>{error || authError}</span></div>}

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
