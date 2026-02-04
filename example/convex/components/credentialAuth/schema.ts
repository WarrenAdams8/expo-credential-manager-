import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  config: defineTable({
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
  }),

  users: defineTable({
    email: v.optional(v.string()),
    googleSub: v.optional(v.string()),
    passwordHash: v.optional(v.string()),
    passwordSalt: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_googleSub", ["googleSub"]),

  passkeys: defineTable({
    userId: v.id("users"),
    credentialId: v.string(),
    publicKey: v.string(),
    counter: v.number(),
    transports: v.optional(v.array(v.string())),
    rpID: v.string(),
    createdAt: v.number(),
  })
    .index("by_credentialId", ["credentialId"])
    .index("by_userId", ["userId"]),

  webauthnChallenges: defineTable({
    userId: v.optional(v.id("users")),
    type: v.union(v.literal("registration"), v.literal("authentication")),
    challenge: v.string(),
    expiresAt: v.number(),
  })
    .index("by_type", ["type"])
    .index("by_userId_and_type", ["userId", "type"]),
});
