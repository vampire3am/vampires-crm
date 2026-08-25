import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export function ProtectedRoute() {
  const { session, loading } = useAuth();

  if (loading) {
    return <div className="app-loader" role="status">Connecting securely…</div>;
  }

  // Strict check: No session -> Must redirect to Login page
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
