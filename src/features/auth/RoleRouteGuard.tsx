import { ArrowLeft, Lock, ShieldAlert, UserCheck } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { useAuth, type RolePermissions } from "./AuthProvider";

interface RoleRouteGuardProps {
  permission: keyof RolePermissions;
  workspaceName: string;
  children: React.ReactNode;
}

export function RoleRouteGuard({ permission, workspaceName, children }: RoleRouteGuardProps) {
  const { profile, permissions } = useAuth();

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  // Check if role has permission
  const isAllowed = permissions[permission];

  if (!isAllowed) {
    return (
      <div className="page-container" style={{ minHeight: "75vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            maxWidth: "520px",
            width: "100%",
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "16px",
            padding: "36px 32px",
            textAlign: "center",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              color: "#EF4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px auto",
            }}
          >
            <Lock size={26} />
          </div>

          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "#EF4444",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              display: "block",
              marginBottom: "6px",
            }}
          >
            Role-Based Access Control (RBAC)
          </span>

          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-main)", margin: "0 0 8px 0" }}>
            {workspaceName} Access Restricted
          </h2>

          <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5, margin: "0 0 20px 0" }}>
            Your account is assigned the role of <strong>{profile.job_title || profile.role}</strong> in{" "}
            <strong>{profile.department}</strong>. This workspace is strictly restricted to authorized department staff.
          </p>

          <div
            style={{
              background: "var(--bg-card-subtle)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "10px",
              padding: "12px 16px",
              fontSize: "12px",
              color: "var(--text-muted)",
              marginBottom: "24px",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-main)", fontWeight: 600, marginBottom: "4px" }}>
              <UserCheck size={14} style={{ color: "var(--accent-blue)" }} />
              <span>Signed In As: {profile.full_name}</span>
            </div>
            <span>Need access? Please contact your Managing Director to update your role permissions.</span>
          </div>

          <Link
            to="/dashboard"
            className="btn-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 20px", textDecoration: "none" }}
          >
            <ArrowLeft size={15} />
            <span>Return to My Authorized Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default RoleRouteGuard;
