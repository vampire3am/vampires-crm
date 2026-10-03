import { CheckCircle2, KeyRound, Loader2, Plus, ShieldCheck, Smartphone, Trash2, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useAuth } from "./AuthProvider";
import { beginMfaEnrollment, removeMfaFactor, verifyMfaFactor, type MfaEnrollment } from "./mfaService";

export function AccountSecurity() {
  const { profile, mfaFactors, refreshMfa } = useAuth();
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [friendlyName, setFriendlyName] = useState("My authenticator");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  const begin = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setEnrollment(await beginMfaEnrollment(friendlyName));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to start authenticator setup.");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!enrollment) return;
    setBusy(true);
    try {
      await removeMfaFactor(enrollment.id);
      setEnrollment(null);
      setCode("");
      await refreshMfa();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to cancel setup.");
    } finally {
      setBusy(false);
    }
  };

  const activate = async (event: FormEvent) => {
    event.preventDefault();
    if (!enrollment) return;
    setBusy(true);
    setError("");
    try {
      await verifyMfaFactor(enrollment.id, code);
      await refreshMfa();
      setEnrollment(null);
      setCode("");
      setNotice("Authenticator enabled. Future sign-ins will require a one-time code.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to verify this authenticator.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (factorId: string) => {
    setRemovingId(factorId);
    setError("");
    setNotice("");
    try {
      await removeMfaFactor(factorId);
      await refreshMfa();
      setNotice(mfaFactors.length === 1
        ? "Authenticator removed. Two-factor authentication is no longer enabled for this account."
        : "Authenticator removed.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to remove this authenticator.");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <section className="account-security-page">
      <header className="account-security-header">
        <div>
          <p className="mfa-eyebrow">ACCOUNT SECURITY</p>
          <h1>Two-factor authentication</h1>
          <p>Protect {profile?.email || "your account"} with codes from Google Authenticator, Microsoft Authenticator, Authy, or another TOTP app.</p>
        </div>
        <div className={`mfa-status-pill ${mfaFactors.length ? "enabled" : "disabled"}`}>
          {mfaFactors.length ? <ShieldCheck size={18} /> : <KeyRound size={18} />}
          {mfaFactors.length ? "Enabled" : "Not enabled"}
        </div>
      </header>

      {error && <div className="security-message error" role="alert">{error}</div>}
      {notice && <div className="security-message success" role="status"><CheckCircle2 size={17} />{notice}</div>}

      <div className="security-panel">
        <div className="security-panel-title">
          <div><Smartphone size={20} /><div><h2>Authenticator apps</h2><p>Each verified app can approve a CRM sign-in.</p></div></div>
          {!enrollment && <button className="security-primary-button" type="button" onClick={() => void begin()} disabled={busy}>
            {busy ? <Loader2 className="spin" size={16} /> : <Plus size={16} />} Add authenticator
          </button>}
        </div>

        {mfaFactors.length === 0 && !enrollment && <div className="security-empty"><KeyRound size={26} /><strong>No authenticator registered</strong><span>Add one to require a changing 6-digit code after your password.</span></div>}

        {mfaFactors.map(factor => (
          <div className="mfa-factor-row" key={factor.id}>
            <div className="mfa-factor-icon"><Smartphone size={18} /></div>
            <div><strong>{factor.friendly_name || "Authenticator app"}</strong><span>Verified and active</span></div>
            <button type="button" className="security-danger-button" onClick={() => void remove(factor.id)} disabled={removingId === factor.id}>
              {removingId === factor.id ? <Loader2 className="spin" size={15} /> : <Trash2 size={15} />} Remove
            </button>
          </div>
        ))}

        {enrollment && (
          <div className="mfa-enrollment">
            <button type="button" className="mfa-close" onClick={() => void cancel()} aria-label="Cancel authenticator setup"><X size={18} /></button>
            <div className="mfa-enrollment-copy"><span>STEP 1</span><h2>Scan this QR code</h2><p>Open your authenticator app, add an account, and scan the code. The QR code and secret are sensitive and are never stored by the CRM.</p></div>
            <div className="mfa-setup-grid">
              <img className="mfa-qr-code" src={enrollment.qrCode} alt="Authenticator setup QR code" />
              <div className="mfa-manual-setup"><label htmlFor="mfa-secret">Cannot scan? Enter this setup key</label><input id="mfa-secret" value={enrollment.secret} readOnly onFocus={event => event.currentTarget.select()} /><small>Account: {profile?.email}<br />Type: Time based (TOTP)</small></div>
            </div>
            <form onSubmit={activate} className="mfa-activate-form">
              <div><span>STEP 2</span><label htmlFor="mfa-activation-code">Verify the current 6-digit code</label></div>
              <input id="mfa-activation-code" className="mfa-code-input" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" required />
              <button className="security-primary-button" type="submit" disabled={busy || code.length !== 6}>{busy ? <Loader2 className="spin" size={16} /> : <ShieldCheck size={16} />} Activate</button>
            </form>
          </div>
        )}
      </div>

      {!enrollment && <div className="security-name-card"><div><label htmlFor="authenticator-name">Name for the next authenticator</label><p>This helps you recognize the device later.</p></div><input id="authenticator-name" value={friendlyName} onChange={event => setFriendlyName(event.target.value.slice(0, 40))} /></div>}
    </section>
  );
}

export default AccountSecurity;
