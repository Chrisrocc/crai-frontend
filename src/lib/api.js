// src/lib/api.js
// Use Cloudflare Pages Functions proxy by default.
// If you really need to hit a different origin, set VITE_API_URL at build time.
const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");

async function jfetch(path, opts = {}) {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  const ct = res.headers.get("content-type") || "";
  const isJSON = ct.includes("application/json");
  const body = isJSON ? await res.json().catch(() => ({})) : {};
  if (!res.ok) {
    const err = new Error(body?.message || `HTTP ${res.status}`);
    err.response = { data: body, status: res.status };
    throw err;
  }
  return body;
}

export default { jfetch };
export { jfetch };
