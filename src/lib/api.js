// DEBUG: remove later
console.log("VITE_API_URL =", import.meta.env.VITE_API_URL);

// src/lib/api.js
import axios from "axios";

const base = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, ""); // strip trailing slash

const api = axios.create({
  baseURL: base,                // e.g. https://.../api  (from your .env.*)
  withCredentials: true,        // send/receive cookies for auth
  timeout: 30000,
  headers: { "Cache-Control": "no-cache" }
});

// normalize relative paths so you can call api.get("/cars") or api.get("cars")
api.interceptors.request.use((config) => {
  if (!config.url?.startsWith("http")) {
    config.url = `/${String(config.url || "").replace(/^\/+/, "")}`;
  }
  return config;
});

export default api;
