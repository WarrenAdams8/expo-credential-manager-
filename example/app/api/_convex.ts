function getConvexHttpUrl(): string | null {
  return process.env.CONVEX_HTTP_URL ?? process.env.EXPO_PUBLIC_CONVEX_HTTP_URL ?? null;
}

export async function proxyToConvex(req: Request, path: string): Promise<Response> {
  const base = getConvexHttpUrl();
  if (!base) {
    return new Response("Missing CONVEX_HTTP_URL (set in .env)", { status: 500 });
  }

  const incoming = new URL(req.url);
  const target = new URL(path, base);
  target.search = incoming.search;

  const headers = new Headers(req.headers);
  headers.delete("host");

  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();
  const upstream = await fetch(target.toString(), {
    method: req.method,
    headers,
    body,
  });

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: upstream.headers,
  });
}
