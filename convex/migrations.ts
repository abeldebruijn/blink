import { ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internalMutation } from "./_generated/server";

export const backfillHomeFeedItemFeedIds = internalMutation({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("homeFeedItems")
      .paginate(args.paginationOpts);
    let backfilled = 0;
    let skipped = 0;

    for (const item of page.page) {
      if (item.feedId !== undefined) {
        skipped += 1;
        continue;
      }

      const post = await ctx.db.get(item.postId);
      if (post?.feedId === undefined || post.feedId === null) {
        throw new ConvexError(
          `Cannot backfill feedId for homeFeedItem ${item._id}`,
        );
      }

      await ctx.db.patch(item._id, {
        feedId: post.feedId,
        updatedAt: Date.now(),
      });
      backfilled += 1;
    }

    return {
      scanned: page.page.length,
      backfilled,
      skipped,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});
