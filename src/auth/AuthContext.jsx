// src/auth/AuthContext.jsx
import { createContext, useContext } from "react";

export const AuthCtx = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthCtx);
  return ctx;
}
