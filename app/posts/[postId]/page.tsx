import { ReadingViewClient } from "./reading-view-client";

type ReadingViewPageProps = {
  params: Promise<{
    postId: string;
  }>;
};

export default async function ReadingViewPage({
  params,
}: ReadingViewPageProps) {
  const { postId } = await params;

  return <ReadingViewClient postId={postId} />;
}
