import { internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const setConfig = mutation({
  args: {
    rpID: v.string(),
    rpName: v.optional(v.string()),
    origin: v.string(),
    issuer: v.string(),
    audience: v.string(),
    jwtPrivateKeyPem: v.string(),
    jwtPublicJwk: v.string(),
    jwtKid: v.string(),
    tokenTtlSeconds: v.optional(v.number()),
    googleServerClientId: v.optional(v.string()),
    googleHostedDomain: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("config").first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }
    return await ctx.db.insert("config", args);
  },
});

export const getConfig = internalQuery({
  args: {},
  handler: async (ctx) => {
    const config = await ctx.db.query("config").first();
    if (!config) throw new Error("Missing auth config");
    return config;
  },
});

export const getJwks = query({
  args: {},
  handler: async (ctx) => {
    const config = await ctx.db.query("config").first();
    if (!config) throw new Error("Missing auth config");
    const jwk = JSON.parse(config.jwtPublicJwk);
    return { keys: [jwk] };
  },
});
