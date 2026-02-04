import { proxyToConvex } from "../_convex";

export async function GET(req: Request) {
  return await proxyToConvex(req, "/api/webauthn/authentication");
}
