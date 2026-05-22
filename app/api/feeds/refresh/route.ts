import { start } from "workflow/api";
import { requireCurrentReader, jsonError } from "@/lib/server/convex";
import type { Id } from "@/convex/_generated/dataModel";
import { manualRefreshWorkflow } from "@/workflows/imports";

export async function POST(request: Request) {
  try {
    const reader = await requireCurrentReader();
    const body = (await request.json()) as { feedSubscriptionId?: unknown };
    if (typeof body.feedSubscriptionId !== "string") {
      return Response.json(
        { error: "feedSubscriptionId is required" },
        { status: 400 },
      );
    }

    await start(manualRefreshWorkflow, [
      reader._id,
      body.feedSubscriptionId as Id<"feedSubscriptions">,
    ]);
    return Response.json({ started: true });
  } catch (error) {
    return jsonError(error);
  }
}
