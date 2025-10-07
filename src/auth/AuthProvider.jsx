// src/auth/AuthProvider.jsx
import { useEffect, useState, useCallback } from "react";
import api from "../lib/api";
import { AuthCtx } from "./AuthContext";

export default function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me"); // baseURL already has /api
      setUser(data?.data || data || true);
    } catch {
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  // optionally react to 401s globally (keeps UI in sync if session expires)
  useEffect(() => {
    const id = api.interceptors.response.use(
      (r) => r,
      (err) => {
        if (err?.response?.status === 401) setUser(null);
        return Promise.reject(err);
      }
    );
    return () => api.interceptors.response.eject(id);
  }, []);

  const login = useCallback(async (password) => {
    await api.post("/auth/login", { password });
    await fetchMe();
  }, [fetchMe]);

  const logout = useCallback(async () => {
    await api.post("/auth/logout", {});
    setUser(null);
  }, []);

  const value = {
    ready,
    loggedIn: !!user,
    user,
    login,
    logout,
    refresh: fetchMe,
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
