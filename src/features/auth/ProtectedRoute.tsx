import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { CrmSkeleton } from "../../components/common/CrmSkeleton";

export function ProtectedRoute() {
  const { session, loading } = useAuth();

  if (loading) {
    return <CrmSkeleton />;
  }

  // Strict check: No session -> Must redirect to Login page
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
