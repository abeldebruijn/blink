import { start } from "workflow/api";
import { requireCurrentReader, jsonError } from "@/lib/server/convex";
import { preflightFeedUrl } from "@/lib/server/feed-preflight";
import { initialImportWorkflow } from "@/workflows/imports";

export async function POST(request: Request) {
  try {
    const reader = await requireCurrentReader();
    console.log("TEST", reader);
    const body = (await request.json()) as { submittedFeedUrl?: unknown };

    if (typeof body.submittedFeedUrl !== "string") {
      return Response.json(
        { error: "submittedFeedUrl is required" },
        { status: 400 },
      );
    }

    const submittedFeedUrl = await preflightFeedUrl(body.submittedFeedUrl);
    await start(initialImportWorkflow, [reader._id, submittedFeedUrl]);
    return Response.json({ started: true });
  } catch (error) {
    console.error(error);
    return jsonError(error);
  }
}
