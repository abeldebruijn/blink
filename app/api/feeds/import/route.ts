import { start } from "workflow/api";
import { requireCurrentReader, jsonError } from "@/lib/server/convex";
import { initialImportWorkflow } from "@/workflows/imports";

export async function POST(request: Request) {
  try {
    const reader = await requireCurrentReader();
    const body = (await request.json()) as { submittedFeedUrl?: unknown };
    if (typeof body.submittedFeedUrl !== "string") {
      return Response.json(
        { error: "submittedFeedUrl is required" },
        { status: 400 },
      );
    }

    await start(initialImportWorkflow, [reader._id, body.submittedFeedUrl]);
    return Response.json({ started: true });
  } catch (error) {
    return jsonError(error);
  }
}
