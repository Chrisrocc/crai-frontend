// src/auth/AuthProvider.jsx
/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useEffect, useState } from "react";

const AuthCtx = createContext(null);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  // Helper: JSON fetch with credentials
  async function jfetch(path, opts = {}) {
    const res = await fetch(path, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
      ...opts,
    });
    const isJSON = (res.headers.get("content-type") || "").includes("application/json");
    const body = isJSON ? await res.json().catch(() => ({})) : {};
    if (!res.ok) {
      const err = new Error(body?.message || `HTTP ${res.status}`);
      err.response = { data: body, status: res.status };
      throw err;
    }
    return body;
  }

  // Try session on mount
  useEffect(() => {
    (async () => {
      try {
        const me = await jfetch("/api/auth/me");
        setUser(me?.user || { role: "user" });
      } catch {
        setUser(null);
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  // Called by Login.jsx
  async function login(password) {
    const data = await jfetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    });

    // After backend issued cookie (and returned { token }),
    // let caller use data.token to hit /api/token-cookie.
    try {
      const me = await jfetch("/api/auth/me");
      setUser(me?.user || { role: "user" });
    } catch {
      // ignore; Login.jsx will still try token-cookie and then navigate
    }
    return data; // IMPORTANT: contains { message: "ok", token }
  }

  async function logout() {
    try {
      await jfetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
    }
  }

  const value = { user, booting, login, logout, isAuthed: !!user };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
