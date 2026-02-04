"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { OAuth2Client } from "google-auth-library";
import { internal } from "./_generated/api";
import { SignJWT, importPKCS8 } from "jose";

const googleClient = new OAuth2Client();
const googleAudience = process.env.GOOGLE_SERVER_CLIENT_ID!;
const hostedDomain = process.env.GOOGLE_HOSTED_DOMAIN;

const issuer = process.env.CONVEX_ISSUER!;
const audience = process.env.CONVEX_AUDIENCE!;
const privateKeyPem = process.env.JWT_PRIVATE_KEY_PEM!;
const keyId = process.env.JWT_KID!;

async function signConvexJwt(sub: string) {
  const key = await importPKCS8(privateKeyPem, "RS256");
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({})
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: keyId })
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 60)
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(sub)
    .sign(key);
}

export const verifyGoogleIdToken = action({
  args: { idToken: v.string() },
  handler: async (ctx, args) => {
    const ticket = await googleClient.verifyIdToken({
      idToken: args.idToken,
      audience: googleAudience,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.sub) throw new Error("Invalid token");

    if (hostedDomain && payload.hd !== hostedDomain) {
      throw new Error("Wrong hosted domain");
    }

    const userId = await ctx.runMutation(internal.users.upsertByGoogleSub, {
      googleSub: payload.sub,
      email: payload.email ?? undefined,
    });

    const convexToken = await signConvexJwt(userId);
    return { convexToken };
  },
});
