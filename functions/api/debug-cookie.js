// functions/api/debug-cookie.js
export async function onRequest({ request }) {
  const cookie = request.headers.get("cookie") || "";
  const ua = request.headers.get("user-agent") || "";
  return new Response(JSON.stringify({ cookie, ua }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
