import { start } from "workflow/api";
import { requireCurrentReader, jsonError } from "@/lib/server/convex";
import type { Id } from "@/convex/_generated/dataModel";
import { replacementImportWorkflow } from "@/workflows/imports";

export async function POST(request: Request) {
  try {
    const reader = await requireCurrentReader();
    const body = (await request.json()) as {
      feedSubscriptionId?: unknown;
      submittedFeedUrl?: unknown;
    };
    if (
      typeof body.feedSubscriptionId !== "string" ||
      typeof body.submittedFeedUrl !== "string"
    ) {
      return Response.json(
        { error: "feedSubscriptionId and submittedFeedUrl are required" },
        { status: 400 },
      );
    }

    await start(replacementImportWorkflow, [
      reader._id,
      body.feedSubscriptionId as Id<"feedSubscriptions">,
      body.submittedFeedUrl,
    ]);
    return Response.json({ started: true });
  } catch (error) {
    return jsonError(error);
  }
}
