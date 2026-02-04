import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { components } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/api/webauthn/registration",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const email = url.searchParams.get("email");
    if (!email) return new Response("email is required", { status: 400 });

    const json = await ctx.runAction(components.credentialAuth.webauthn.beginRegistration, {
      email,
    });
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
    const result = await ctx.runAction(components.credentialAuth.webauthn.finishRegistration, {
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
    const json = await ctx.runAction(components.credentialAuth.webauthn.beginAuthentication, {});
    return new Response(json, { headers: { "content-type": "application/json" } });
  }),
});

http.route({
  path: "/api/webauthn/authentication/finish",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const responseJson = await req.text();
    const result = await ctx.runAction(
      components.credentialAuth.webauthn.finishAuthentication,
      {
        responseJson,
      }
    );
    return Response.json(result);
  }),
});

http.route({
  path: "/api/google/verify",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const idToken = await req.text();
    const result = await ctx.runAction(components.credentialAuth.googleAuth.verifyGoogleIdToken, {
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
    const result = await ctx.runAction(components.credentialAuth.passwordAuth.registerWithPassword, {
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
    const result = await ctx.runAction(components.credentialAuth.passwordAuth.loginWithPassword, {
      email,
      password,
    });
    return Response.json(result);
  }),
});

http.route({
  path: "/.well-known/jwks.json",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const jwks = await ctx.runQuery(components.credentialAuth.config.getJwks, {});
    return Response.json(jwks);
  }),
});

export default http;
