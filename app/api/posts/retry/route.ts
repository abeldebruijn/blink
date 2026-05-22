import { start } from "workflow/api";
import { requireCurrentReader, jsonError } from "@/lib/server/convex";
import type { Id } from "@/convex/_generated/dataModel";
import { postRetryWorkflow } from "@/workflows/imports";

export async function POST(request: Request) {
  try {
    const reader = await requireCurrentReader();
    const body = (await request.json()) as { postId?: unknown };
    if (typeof body.postId !== "string") {
      return Response.json({ error: "postId is required" }, { status: 400 });
    }

    await start(postRetryWorkflow, [reader._id, body.postId as Id<"posts">]);
    return Response.json({ started: true });
  } catch (error) {
    return jsonError(error);
  }
}
