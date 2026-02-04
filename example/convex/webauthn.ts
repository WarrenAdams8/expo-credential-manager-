"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { SignJWT, importPKCS8 } from "jose";

const rpID = process.env.RP_ID!;
const rpName = "Your App";
const origin = process.env.ORIGIN!;
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

export const beginRegistration = action({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const userId = await ctx.runMutation(internal.users.upsertByEmail, {
      email: args.email,
    });

    const options = await generateRegistrationOptions({
      rpID,
      rpName,
      userID: userId,
      userName: args.email,
      attestationType: "none",
    });

    await ctx.runMutation(internal.passkeys.storeChallenge, {
      userId,
      type: "registration",
      challenge: options.challenge,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    return JSON.stringify(options);
  },
});

export const finishRegistration = action({
  args: { email: v.string(), responseJson: v.string() },
  handler: async (ctx, args) => {
    const userId = await ctx.runMutation(internal.users.upsertByEmail, {
      email: args.email,
    });

    const response = JSON.parse(args.responseJson);

    const record = await ctx.runMutation(internal.passkeys.consumeChallenge, {
      userId,
      type: "registration",
    });
    if (!record) throw new Error("No registration challenge");

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: record.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new Error("Registration failed");
    }

    const { credentialID, credentialPublicKey, counter } =
      verification.registrationInfo;

    await ctx.runMutation(internal.passkeys.upsertPasskey, {
      userId,
      credentialId: Buffer.from(credentialID).toString("base64url"),
      publicKey: Buffer.from(credentialPublicKey).toString("base64url"),
      counter,
      rpID,
    });

    const convexToken = await signConvexJwt(userId);
    return { convexToken };
  },
});

export const beginAuthentication = action({
  args: {},
  handler: async (ctx) => {
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "preferred",
    });

    await ctx.runMutation(internal.passkeys.storeChallenge, {
      userId: undefined,
      type: "authentication",
      challenge: options.challenge,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    return JSON.stringify(options);
  },
});

export const finishAuthentication = action({
  args: { responseJson: v.string() },
  handler: async (ctx, args) => {
    const response = JSON.parse(args.responseJson);

    const record = await ctx.runMutation(internal.passkeys.consumeChallenge, {
      userId: undefined,
      type: "authentication",
    });
    if (!record) throw new Error("No authentication challenge");

    const credentialId = response.id;
    const passkey = await ctx.runQuery(internal.passkeys.getPasskeyByCredentialId, {
      credentialId,
    });
    if (!passkey) throw new Error("Unknown credential");

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: record.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: Buffer.from(passkey.credentialId, "base64url"),
        credentialPublicKey: Buffer.from(passkey.publicKey, "base64url"),
        counter: passkey.counter,
      },
    });

    if (!verification.verified) throw new Error("Auth failed");

    await ctx.runMutation(internal.passkeys.updateCounter, {
      credentialId,
      counter: verification.authenticationInfo.newCounter,
    });

    const convexToken = await signConvexJwt(passkey.userId);
    return { convexToken };
  },
});
