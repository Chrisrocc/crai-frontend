/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from "react";
import { AuthCtx } from "./AuthContext";

/** Resolve backend base URL (no placeholders) */
const ENV_BASE =
  (import.meta.env?.VITE_API_BASE && import.meta.env.VITE_API_BASE.trim()) ||
  (import.meta.env?.VITE_API_URL && import.meta.env.VITE_API_URL.trim()) ||
  "";

const API_BASE =
  ENV_BASE ||
  ((location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? "http://localhost:5000/api"
    : "https://crai-backend-production.up.railway.app/api"); // prod fallback

function getToken() {
  try {
    return localStorage.getItem("sid_token") || "";
  } catch (e) {
    console.debug("getToken localStorage unavailable", e);
    return "";
  }
}

function setToken(t) {
  try {
    if (t) localStorage.setItem("sid_token", t);
    else localStorage.removeItem("sid_token");
  } catch (e) {
    console.debug("setToken localStorage unavailable", e);
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
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  };

  const token = getToken();
  if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    credentials: "include", // keep cookie path for browsers that allow it
    headers,
    ...opts,
  });

  const isJSON = (res.headers.get("content-type") || "").includes("application/json");
  const body = isJSON ? await res.json().catch(() => ({})) : {};

  if (!res.ok) {
    const err = new Error(body?.message || `HTTP ${res.status}`);
    // attach status/body for callers
    // eslint-disable-next-line no-unused-expressions
    (err).response = { data: body, status: res.status };
    throw err;
  }
  return body;
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  // Attempt session on mount
  useEffect(() => {
    (async () => {
      try {
        const me = await jfetch("/auth/me");
        setUser(me?.user || { role: "user" });
      } catch (e) {
        console.debug("me() at mount failed", e);
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

    // Store bearer token as fallback when cookies are blocked
    try {
      if (data?.token) setToken(data.token);
    } catch (e) {
      console.debug("Failed to persist token", e);
    }

    // Try to read session immediately (cookie may already be set)
    try {
      const me = await jfetch("/auth/me");
      setUser(me?.user || { role: "user" });
    } catch (e) {
      // If cookies are blocked, subsequent requests still succeed via Bearer
      console.debug("me() after login failed (likely cookies blocked)", e);
    }
    return data; // { message: "ok", token }
  }

  async function logout() {
    try {
      await jfetch("/auth/logout", { method: "POST" });
    } catch (e) {
      console.debug("logout() request failed", e);
    } finally {
      setToken("");
      setUser(null);
    }
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
