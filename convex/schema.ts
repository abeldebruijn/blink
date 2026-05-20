import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The schema is entirely optional.
// You can delete this file (schema.ts) and the
// app will continue to work.
// The schema provides more precise TypeScript types.
export default defineSchema({
  numbers: defineTable({
    value: v.number(),
  }),
  readers: defineTable({
    tokenIdentifier: v.string(),
    subject: v.string(),
    issuer: v.string(),
    name: v.union(v.string(), v.null()),
    email: v.union(v.string(), v.null()),
    pictureUrl: v.union(v.string(), v.null()),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastSeenAt: v.number(),
  }).index("by_tokenIdentifier", ["tokenIdentifier"]),
});
