/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from "react";
import { AuthCtx } from "./AuthContext";

/** Resolve backend base URL (Railway prod, env if set, localhost in dev) */
const ENV_BASE =
  (import.meta.env?.VITE_API_BASE && import.meta.env.VITE_API_BASE.trim()) ||
  (import.meta.env?.VITE_API_URL && import.meta.env.VITE_API_URL.trim()) ||
  "";

const API_BASE =
  ENV_BASE ||
  ((location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? "http://localhost:5000/api"
    : "https://crai-backend-production.up.railway.app/api");

function getToken() {
  try {
    return localStorage.getItem("sid_token") || "";
  } catch (e) {
    console.debug("localStorage getItem failed", e);
    return "";
  }
}

function setToken(t) {
  try {
    if (t) localStorage.setItem("sid_token", t);
    else localStorage.removeItem("sid_token");
  } catch (e) {
    console.debug("localStorage set/remove failed", e);
  }
}

function toApiUrl(path) {
  if (!path) return API_BASE;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("/api/")) return API_BASE + path.slice(4); // strip leading /api
  if (path.startsWith("/")) return API_BASE + path;
  return API_BASE + "/" + path.replace(/^api\//, "");
}

/** JSON fetch that sends cookies AND Bearer token (hybrid) */
async function jfetch(path, opts = {}) {
  const url = toApiUrl(path);

  const headers = {
    ...(opts.headers || {}),
  };

  // Only set JSON Content-Type when we actually send a body
  if (opts.body && !headers["Content-Type"] && !headers["content-type"]) {
    headers["Content-Type"] = "application/json";
  }

  const token = getToken();
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    credentials: "include",
    ...opts,
    headers,
  });

  const isJSON = (res.headers.get("content-type") || "").includes(
    "application/json"
  );
  let body = {};
  if (isJSON) {
    try {
      body = await res.json();
    } catch (e) {
      console.debug("JSON parse failed for", url, e);
      body = {};
    }
  }

  if (!res.ok) {
    const err = new Error(body?.message || `HTTP ${res.status}`);
    err.response = { data: body, status: res.status };
    throw err;
  }

  return body;
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  // On first load, try to restore session (cookie or bearer)
  useEffect(() => {
    (async () => {
      try {
        const me = await jfetch("/auth/me");
        setUser(me?.user || { role: "user" });
      } catch (e) {
        console.debug("GET /auth/me on mount failed", e);
        setUser(null);
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  // Called by Login.jsx
  async function login(password) {
    const data = await jfetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    });

    // Store bearer token so all future requests are authenticated
    if (data?.token) setToken(data.token);

    // Immediately consider user logged in
    setUser({ role: "user" });

    // Try to hydrate from /me; if it fails (cookies blocked), Bearer still works
    try {
      const me = await jfetch("/auth/me");
      if (me?.user) setUser(me.user);
    } catch (e) {
      console.debug(
        "GET /auth/me right after login failed (likely cookies blocked)",
        e
      );
    }

    return data; // { message: "ok", token }
  }

  async function logout() {
    try {
      await jfetch("/auth/logout", { method: "POST" });
    } catch (e) {
      console.debug("POST /auth/logout failed", e);
    }
    setToken("");
    setUser(null);
  }

  const value = {
    user,
    booting,
    ready: !booting,
    loggedIn: !!user,
    isAuthed: !!user,
    login,
    logout,
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
