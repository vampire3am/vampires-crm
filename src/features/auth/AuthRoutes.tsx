import { AuthProvider } from "./AuthProvider";
import { ProtectedRoute } from "./ProtectedRoute";
import { Login } from "../../pages/Login";
export function ProtectedArea(){return <AuthProvider><ProtectedRoute/></AuthProvider>}
export function LoginArea(){return <AuthProvider><Login/></AuthProvider>}
