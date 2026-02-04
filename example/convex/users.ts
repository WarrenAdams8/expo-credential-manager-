import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const upsertByEmail = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();

    if (existing) return existing._id;

    return await ctx.db.insert("users", {
      email: args.email,
      createdAt: Date.now(),
    });
  },
});

export const upsertByGoogleSub = internalMutation({
  args: { googleSub: v.string(), email: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_googleSub", (q) => q.eq("googleSub", args.googleSub))
      .unique();

    if (existing) return existing._id;

    return await ctx.db.insert("users", {
      googleSub: args.googleSub,
      email: args.email,
      createdAt: Date.now(),
    });
  },
});
