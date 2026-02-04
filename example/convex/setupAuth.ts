"use node";

import { action } from "./_generated/server";
import { components } from "./_generated/api";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export const configure = action({
  args: {},
  handler: async (ctx) => {
    const result = await ctx.runMutation(components.credentialAuth.config.setConfig, {
      rpID: required("RP_ID"),
      rpName: process.env.RP_NAME,
      origin: required("ORIGIN"),
      issuer: required("CONVEX_ISSUER"),
      audience: required("CONVEX_AUDIENCE"),
      jwtPrivateKeyPem: required("JWT_PRIVATE_KEY_PEM"),
      jwtPublicJwk: required("JWT_PUBLIC_JWK"),
      jwtKid: required("JWT_KID"),
      tokenTtlSeconds: process.env.JWT_TTL_SECONDS
        ? Number(process.env.JWT_TTL_SECONDS)
        : undefined,
      googleServerClientId: process.env.GOOGLE_SERVER_CLIENT_ID,
      googleHostedDomain: process.env.GOOGLE_HOSTED_DOMAIN,
    });

    return { ok: true, configId: result };
  },
});
