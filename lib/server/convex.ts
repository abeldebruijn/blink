import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export async function requireCurrentReader() {
  const { getToken, userId } = await auth();
  if (userId === null) {
    throw new Response("Authentication required", { status: 401 });
  }

  const token = await getToken({ template: "convex" });
  if (token === null) {
    throw new Response("Convex auth token unavailable", { status: 401 });
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (convexUrl === undefined || convexUrl.trim() === "") {
    throw new Response("NEXT_PUBLIC_CONVEX_URL is not configured", {
      status: 500,
    });
  }

  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);
  return await client.mutation(api.readers.ensureCurrent, {});
}

export function jsonError(error: unknown) {
  if (error instanceof Response) {
    return error;
  }

  return Response.json(
    { error: error instanceof Error ? error.message : "Request failed" },
    { status: 500 },
  );
}
