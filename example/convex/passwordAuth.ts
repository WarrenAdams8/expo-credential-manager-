"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { SignJWT, importPKCS8 } from "jose";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

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

function hashPassword(password: string, salt: Buffer) {
  return scryptSync(password, salt, 64);
}

export const registerWithPassword = action({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.runQuery(internal.users.getByEmail, {
      email: args.email,
    });

    if (existing?.passwordHash) {
      throw new Error("Email already registered");
    }

    const userId = existing?._id ??
      (await ctx.runMutation(internal.users.upsertByEmail, { email: args.email }));

    const salt = randomBytes(16);
    const hash = hashPassword(args.password, salt);

    await ctx.runMutation(internal.users.setPassword, {
      userId,
      passwordHash: hash.toString("base64"),
      passwordSalt: salt.toString("base64"),
    });

    const convexToken = await signConvexJwt(userId);
    return { convexToken };
  },
});

export const loginWithPassword = action({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getByEmail, {
      email: args.email,
    });

    if (!user?.passwordHash || !user.passwordSalt) {
      throw new Error("Invalid credentials");
    }

    const salt = Buffer.from(user.passwordSalt, "base64");
    const expected = Buffer.from(user.passwordHash, "base64");
    const actual = hashPassword(args.password, salt);

    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new Error("Invalid credentials");
    }

    const convexToken = await signConvexJwt(user._id);
    return { convexToken };
  },
});
