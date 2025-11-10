// src/lib/api.js
// fetch-based client that mimics axios ({ data, status, headers })
// Sends cookies, optional Bearer token, and is FormData-safe.

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
    return (
      localStorage.getItem("sid_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      ""
    );
  } catch {
    return "";
  }
}

function toUrl(path) {
  if (!path) return API_BASE;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/api/")) return API_BASE + path.slice(4); // strip leading /api
  if (path.startsWith("/")) return API_BASE + path;
  return API_BASE + "/" + path.replace(/^api\//, "");
}

function isFormData(x) {
  return typeof FormData !== "undefined" && x instanceof FormData;
}

async function request(method, path, body, opts = {}) {
  const url = toUrl(path);

  const extra = opts.headers || {};
  const headers = {
    Accept: "application/json",
    ...extra,
  };

  // Only set Content-Type when we actually have a JSON body.
  // This keeps simple GETs simple → fewer CORS preflights.
  if (body != null && !isFormData(body)) {
    if (!headers["Content-Type"] && !headers["content-type"]) {
      headers["Content-Type"] = "application/json";
    }
  }

  // For FormData let the browser set correct multipart boundary.
  if (isFormData(body)) {
    delete headers["Content-Type"];
    delete headers["content-type"];
  }

  const token = getToken();
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    credentials: "include",
    headers,
    body:
      body == null
        ? undefined
        : isFormData(body)
        ? body
        : JSON.stringify(body),
  });

  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");

  const payload =
    res.status === 204
      ? null
      : isJson
      ? await res.json().catch(() => ({}))
      : await res.text();

  const response = {
    data: payload,
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
  };

  if (!res.ok) {
    const msg =
      (payload && (payload.message || payload.error)) || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.response = response;
    throw err;
  }

  return response;
}

const api = {
  get: (path, opts) => request("GET", path, undefined, opts),
  delete: (path, opts) => request("DELETE", path, undefined, opts),
  post: (path, body, opts) => request("POST", path, body, opts),
  put: (path, body, opts) => request("PUT", path, body, opts),
  patch: (path, body, opts) => request("PATCH", path, body, opts),
  getBase: () => API_BASE,
};

export default api;
