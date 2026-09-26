import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { AuthStatus } from "./AuthStatus";

export function ProtectedRoute() {
  const { session, profile, loading, authError } = useAuth();

  if (loading || authError) {
    return <AuthStatus />;
  }

  // Strict check: No session -> Must redirect to Login page
  if (!session || !profile) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
