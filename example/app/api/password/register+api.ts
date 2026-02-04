import { proxyToConvex } from "../_convex";

export async function POST(req: Request) {
  return await proxyToConvex(req, "/api/password/register");
}
