"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { OAuth2Client } from "google-auth-library";
import { internal } from "./_generated/api";
import { SignJWT, importPKCS8 } from "jose";

const googleClient = new OAuth2Client();

async function loadConfig(ctx: { runQuery: any }) {
  const config = await ctx.runQuery(internal.config.getConfig, {});
  if (!config.googleServerClientId) {
    throw new Error("Missing googleServerClientId in auth config");
  }
  return config;
}

async function signConvexJwt(config: any, sub: string) {
  const key = await importPKCS8(config.jwtPrivateKeyPem, "RS256");
  const now = Math.floor(Date.now() / 1000);
  const ttl = config.tokenTtlSeconds ?? 60 * 60;
  return await new SignJWT({})
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: config.jwtKid })
    .setIssuedAt(now)
    .setExpirationTime(now + ttl)
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setSubject(sub)
    .sign(key);
}

export const verifyGoogleIdToken = action({
  args: { idToken: v.string() },
  handler: async (ctx, args) => {
    const config = await loadConfig(ctx);

    const ticket = await googleClient.verifyIdToken({
      idToken: args.idToken,
      audience: config.googleServerClientId,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.sub) throw new Error("Invalid token");

    if (config.googleHostedDomain && payload.hd !== config.googleHostedDomain) {
      throw new Error("Wrong hosted domain");
    }

    const userId = await ctx.runMutation(internal.users.upsertByGoogleSub, {
      googleSub: payload.sub,
      email: payload.email ?? undefined,
    });

    const convexToken = await signConvexJwt(config, userId);
    return { convexToken };
  },
});
