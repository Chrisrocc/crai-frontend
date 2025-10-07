// functions/api/[[path]].js
export async function onRequest(context) {
  const { request, params } = context;

  // ✅ Handle our special endpoint for first-party cookie setting
  if (params.path === "token-cookie" && request.method === "POST") {
    try {
      const { token } = await request.json();

      if (!token) {
        return new Response(JSON.stringify({ message: "Missing token" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Set a cookie scoped to your own domain (Pages), works on Brave/Chrome iOS/Android
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": `sid=${token}; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=${60 * 60 * 8}`,
        },
      });
    } catch (e) {
      return new Response(JSON.stringify({ message: "Bad Request", error: e.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // ✅ Default proxy for all other API calls
  const upstream = new URL(request.url);
  upstream.protocol = "https:";
  upstream.hostname = "crai-backend-production.up.railway.app"; // your backend API host
  upstream.pathname = `/api/${params.path || ""}`;

  const init = {
    method: request.method,
    headers: request.headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    redirect: "manual",
  };

  const resp = await fetch(upstream, init);
  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: resp.headers,
  });
}
