import type { Factor } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

export type MfaFactor = Factor<"totp">;

export interface MfaEnrollment {
  id: string;
  friendlyName: string;
  qrCode: string;
  secret: string;
  uri: string;
}

function mfaError(error: unknown, fallback: string) {
  const message = error && typeof error === "object" && "message" in error
    ? String((error as { message?: unknown }).message ?? "")
    : "";
  if (/invalid.*(code|totp)|challenge.*expired|verification.*failed/i.test(message)) {
    return "That authenticator code is invalid or expired. Wait for a new code and try again.";
  }
  if (/factor.*exists|already.*enrolled/i.test(message)) {
    return "An authenticator with this name is already registered.";
  }
  if (/aal2|assurance level|mfa.*required/i.test(message)) {
    return "Verify your current authenticator before changing two-factor settings.";
  }
  return fallback;
}

export async function readMfaState() {
  const [{ data: factors, error: factorsError }, { data: assurance, error: assuranceError }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (factorsError) throw new Error(mfaError(factorsError, "Unable to read your authenticator settings. Please retry."));
  if (assuranceError) throw new Error(mfaError(assuranceError, "Unable to verify the security level of this session. Please sign in again."));
  return {
    factors: factors.totp,
    currentLevel: assurance.currentLevel,
    requiresChallenge: factors.totp.length > 0 && assurance.currentLevel !== "aal2",
  };
}

export async function verifyMfaFactor(factorId: string, code: string) {
  const normalized = code.replace(/\D/g, "");
  if (normalized.length !== 6) throw new Error("Enter the 6-digit code from your authenticator app.");
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: normalized });
  if (error) throw new Error(mfaError(error, "Authenticator verification failed. Please retry with the current code."));
}

export async function beginMfaEnrollment(friendlyName: string): Promise<MfaEnrollment> {
  const name = friendlyName.trim() || "AECS CRM Authenticator";
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: name,
    issuer: "AECS CRM",
  });
  if (error) throw new Error(mfaError(error, "Unable to start authenticator setup. Please retry."));
  const qrCode = data.totp.qr_code.startsWith("data:")
    ? data.totp.qr_code
    : `data:image/svg+xml;utf-8,${encodeURIComponent(data.totp.qr_code)}`;
  return { id: data.id, friendlyName: data.friendly_name ?? name, qrCode, secret: data.totp.secret, uri: data.totp.uri };
}

export async function removeMfaFactor(factorId: string) {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw new Error(mfaError(error, "Unable to remove this authenticator. Please retry."));
}
