// functions/api/[[path]].js
export async function onRequest(context) {
  const { request, params } = context;
  const url = new URL(request.url);
  const path = params.path || "";

  // --- 1) FIRST-PARTY COOKIE SETTER (fix for Brave/Chrome on iOS/Android) ---
  // Call this from the frontend AFTER a successful login to set 'sid' as a
  // first-party cookie on *.pages.dev (SameSite=None; Secure; HttpOnly).
  if (path === "token-cookie") {
    // accept token via JSON body or query string
    let token = url.searchParams.get("token");
    if (!token && request.method !== "GET") {
      try {
        const body = await request.json();
        token = body?.token;
      } catch {
        // ignore parse errors
      }
    }

    if (!token) {
      return new Response(JSON.stringify({ ok: false, message: "missing token" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const maxAge = 60 * 60 * 8; // 8h
    const setCookie = [
      `sid=${token}`,
      "Path=/",
      "HttpOnly",
      "Secure",
      "SameSite=None",
      `Max-Age=${maxAge}`,
    ].join("; ");

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": setCookie,
      },
    });
  }

  // --- 2) DEBUG: view the Cookie header the function receives (optional) ---
  if (path === "debug-cookie") {
    return new Response(
      JSON.stringify(
        {
          cookie: request.headers.get("cookie") || "",
          ua: request.headers.get("user-agent") || "",
        },
        null,
        2
      ),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // --- 3) PROXY everything else to your backend /api/* ---
  const upstream = new URL(request.url);
  upstream.protocol = "https:";
  upstream.hostname = "crai-backend-production.up.railway.app"; // your API host
  upstream.pathname = `/api/${path}`;

  const init = {
    method: request.method,
    headers: request.headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    redirect: "manual",
  };

  const resp = await fetch(upstream, init);

  // Stream back response unchanged
  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: resp.headers,
  });
}
