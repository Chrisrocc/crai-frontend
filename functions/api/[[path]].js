export async function onRequest(context) {
  const { request, params } = context;

  const upstream = new URL(request.url);
  upstream.protocol = "https:";
  upstream.hostname = "crai-backend-production.up.railway.app"; // your API host
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
