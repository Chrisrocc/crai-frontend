import { createContext, useContext } from "react";

const defaultAuth = {
  user: null,
  booting: true,
  ready: false,        // becomes true once session check finishes
  loggedIn: false,     // alias for !!user
  isAuthed: false,     // kept for older code
  login: async () => {},
  logout: () => {},
};

export const AuthCtx = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthCtx);
  return ctx ?? defaultAuth; // be forgiving if used outside provider briefly
}
