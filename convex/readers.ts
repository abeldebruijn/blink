import { ConvexError } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

async function requireIdentity(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new ConvexError("Authentication required");
  }
  return identity;
}

async function getReaderByTokenIdentifier(
  ctx: QueryCtx | MutationCtx,
  tokenIdentifier: string,
) {
  return await ctx.db
    .query("readers")
    .withIndex("by_tokenIdentifier", (q) =>
      q.eq("tokenIdentifier", tokenIdentifier),
    )
    .unique();
}

export const current = query({
  args: {},
  handler: async (ctx): Promise<Doc<"readers">> => {
    const identity = await requireIdentity(ctx);
    const reader = await getReaderByTokenIdentifier(
      ctx,
      identity.tokenIdentifier,
    );

    if (reader === null) {
      throw new ConvexError("Reader not found");
    }

    return reader;
  },
});

export const ensureCurrent = mutation({
  args: {},
  handler: async (ctx): Promise<Doc<"readers">> => {
    const identity = await requireIdentity(ctx);
    const now = Date.now();
    const readerFields = {
      tokenIdentifier: identity.tokenIdentifier,
      subject: identity.subject,
      issuer: identity.issuer,
      name: identity.name ?? null,
      email: identity.email ?? null,
      pictureUrl: identity.pictureUrl ?? null,
      updatedAt: now,
      lastSeenAt: now,
    };

    const existing = await getReaderByTokenIdentifier(
      ctx,
      identity.tokenIdentifier,
    );

    if (existing === null) {
      const readerId = await ctx.db.insert("readers", {
        ...readerFields,
        createdAt: now,
      });
      const reader = await ctx.db.get(readerId);
      if (reader === null) {
        throw new ConvexError("Reader create failed");
      }
      return reader;
    }

    await ctx.db.patch(existing._id, readerFields);
    const reader = await ctx.db.get(existing._id);
    if (reader === null) {
      throw new ConvexError("Reader update failed");
    }
    return reader;
  },
});
