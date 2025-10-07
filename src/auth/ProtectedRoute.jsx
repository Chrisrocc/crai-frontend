// src/auth/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function ProtectedRoute({ children }) {
  const { ready, loggedIn } = useAuth();
  if (!ready) return null;
  if (!loggedIn) return <Navigate to="/login" replace />;
  return children;
}
