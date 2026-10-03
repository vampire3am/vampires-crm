import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { AuthStatus } from "./AuthStatus";

export function ProtectedRoute() {
  const { session, profile, loading, authError, mfaStatus, mfaRequired } = useAuth();

  if (loading || (session && mfaStatus === "checking") || authError) {
    return <AuthStatus />;
  }

  // Strict check: No session -> Must redirect to Login page
  if (!session || !profile || mfaRequired || mfaStatus === "not_enrolled") {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
