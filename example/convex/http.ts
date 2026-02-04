import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/api/webauthn/registration",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const email = url.searchParams.get("email");
    if (!email) return new Response("email is required", { status: 400 });

    const json = await ctx.runAction(internal.webauthn.beginRegistration, { email });
    return new Response(json, { headers: { "content-type": "application/json" } });
  }),
});

http.route({
  path: "/api/webauthn/registration/finish",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const { email, responseJson } = await req.json();
    if (!email || !responseJson) {
      return new Response("email and responseJson are required", { status: 400 });
    }
    const result = await ctx.runAction(internal.webauthn.finishRegistration, {
      email,
      responseJson,
    });
    return Response.json(result);
  }),
});

http.route({
  path: "/api/webauthn/authentication",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const json = await ctx.runAction(internal.webauthn.beginAuthentication, {});
    return new Response(json, { headers: { "content-type": "application/json" } });
  }),
});

http.route({
  path: "/api/webauthn/authentication/finish",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const responseJson = await req.text();
    const result = await ctx.runAction(internal.webauthn.finishAuthentication, {
      responseJson,
    });
    return Response.json(result);
  }),
});

http.route({
  path: "/api/google/verify",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const idToken = await req.text();
    const result = await ctx.runAction(internal.googleAuth.verifyGoogleIdToken, {
      idToken,
    });
    return Response.json(result);
  }),
});

http.route({
  path: "/api/password/register",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const { email, password } = await req.json();
    if (!email || !password) {
      return new Response("email and password are required", { status: 400 });
    }
    const result = await ctx.runAction(internal.passwordAuth.registerWithPassword, {
      email,
      password,
    });
    return Response.json(result);
  }),
});

http.route({
  path: "/api/password/login",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const { email, password } = await req.json();
    if (!email || !password) {
      return new Response("email and password are required", { status: 400 });
    }
    const result = await ctx.runAction(internal.passwordAuth.loginWithPassword, {
      email,
      password,
    });
    return Response.json(result);
  }),
});

http.route({
  path: "/.well-known/jwks.json",
  method: "GET",
  handler: httpAction(async () => {
    const jwk = JSON.parse(process.env.JWT_PUBLIC_JWK ?? "{}");
    return Response.json({ keys: [jwk] });
  }),
});

export default http;
