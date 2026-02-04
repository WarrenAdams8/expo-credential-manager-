import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const storeChallenge = internalMutation({
  args: {
    userId: v.optional(v.id("users")),
    type: v.union(v.literal("registration"), v.literal("authentication")),
    challenge: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("webauthnChallenges", args);
  },
});

export const consumeChallenge = internalMutation({
  args: {
    userId: v.optional(v.id("users")),
    type: v.union(v.literal("registration"), v.literal("authentication")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const record = args.userId
      ? await ctx.db
          .query("webauthnChallenges")
          .withIndex("by_userId_and_type", (q) =>
            q.eq("userId", args.userId).eq("type", args.type)
          )
          .order("desc")
          .first()
      : await ctx.db
          .query("webauthnChallenges")
          .withIndex("by_type", (q) => q.eq("type", args.type))
          .order("desc")
          .first();

    if (!record || record.expiresAt < now) return null;

    await ctx.db.delete(record._id);
    return { challenge: record.challenge, userId: record.userId };
  },
});

export const getPasskeyByCredentialId = internalQuery({
  args: { credentialId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("passkeys")
      .withIndex("by_credentialId", (q) => q.eq("credentialId", args.credentialId))
      .unique();
  },
});

export const upsertPasskey = internalMutation({
  args: {
    userId: v.id("users"),
    credentialId: v.string(),
    publicKey: v.string(),
    counter: v.number(),
    transports: v.optional(v.array(v.string())),
    rpID: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("passkeys", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const updateCounter = internalMutation({
  args: { credentialId: v.string(), counter: v.number() },
  handler: async (ctx, args) => {
    const passkey = await ctx.db
      .query("passkeys")
      .withIndex("by_credentialId", (q) => q.eq("credentialId", args.credentialId))
      .unique();
    if (!passkey) return;
    await ctx.db.patch(passkey._id, { counter: args.counter });
  },
});
