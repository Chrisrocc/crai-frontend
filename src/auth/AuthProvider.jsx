/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from "react";
import { AuthCtx } from "./AuthContext";

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  // Helper: JSON fetch with credentials, relative to same-origin (/api proxy)
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

    // Try to read session immediately (cookie may already be set)
    try {
      const me = await jfetch("/api/auth/me");
      setUser(me?.user || { role: "user" });
    } catch {
      // ignore; Login.jsx may also finalize cookie via /api/token-cookie
    }
    return data; // { message: "ok", token }
  }

  async function logout() {
    try {
      await jfetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
    }
  }

  const value = {
    user,
    booting,
    ready: !booting,            // ✅ what ProtectedRoute expects
    loggedIn: !!user,           // ✅ what ProtectedRoute expects
    isAuthed: !!user,           // legacy alias
    login,
    logout,
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
