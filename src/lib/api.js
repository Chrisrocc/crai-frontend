// src/lib/api.js
// Hybrid backend client: correct base URL + cookies + Bearer + JSON.
// Exports a DEFAULT object with .get/.post/.put/.patch/.delete

// 1) Resolve backend base (Railway in prod, env if set, localhost in dev)
const ENV_BASE =
  (import.meta.env?.VITE_API_BASE && import.meta.env.VITE_API_BASE.trim()) ||
  (import.meta.env?.VITE_API_URL && import.meta.env.VITE_API_URL.trim()) ||
  "";

const API_BASE =
  ENV_BASE ||
  ((location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? "http://localhost:5000/api"
    : "https://crai-backend-production.up.railway.app/api");

// 2) Token helpers
function getToken() {
  try { return localStorage.getItem("sid_token") || ""; } catch (e) { console.debug(e); return ""; }
}

// 3) URL builder (accepts "/api/...", "/...", or "path")
function toUrl(path) {
  if (!path) return API_BASE;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("/api/")) return API_BASE + path.slice(4); // strip leading /api
  if (path.startsWith("/")) return API_BASE + path;
  return API_BASE + "/" + path.replace(/^api\//, "");
}

// 4) Core request (supports { headers } the way your code passes it)
async function request(method, path, body, opts = {}) {
  const url = toUrl(path);
  const extraHeaders = opts.headers || {};
  const headers = { "Content-Type": "application/json", ...extraHeaders };

  const token = getToken();
  if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    credentials: "include",
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });

  const isJSON = (res.headers.get("content-type") || "").includes("application/json");
  let data = {};
  if (isJSON) {
    try { data = await res.json(); } catch (e) { console.debug("JSON parse failed for", url, e); }
  }

  if (!res.ok) {
    const err = new Error(data?.message || `HTTP ${res.status}`);
    err.response = { data, status: res.status };
    throw err;
  }
  return data;
}

// 5) Default export with the methods your code expects
const be = {
  get:   (path, opts)        => request("GET",    path, undefined, opts),
  delete:(path, opts)        => request("DELETE", path, undefined, opts),
  post:  (path, body, opts)  => request("POST",   path, body,      opts),
  put:   (path, body, opts)  => request("PUT",    path, body,      opts),
  patch: (path, body, opts)  => request("PATCH",  path, body,      opts),
};

export default be;
