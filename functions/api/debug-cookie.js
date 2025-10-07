export async function onRequest(context) {
  const req = context.request;
  // Read the Cookie header the browser sent to *this* host
  const cookie = req.headers.get("Cookie") || "";
  // Also show the User-Agent so we know which device hit it
  const ua = req.headers.get("User-Agent") || "";
  return new Response(
    JSON.stringify({ cookie, ua }, null, 2),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
