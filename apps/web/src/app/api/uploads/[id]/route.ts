import { deleteUploadImages } from "@denkraum/sdk";
import { getBlobStore, getDb } from "@/lib/db.ts";
import { currentLearner } from "@/lib/session.ts";

/** Deletes the photos of one upload right away. Transcripts and feedback stay until the group ends. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await currentLearner();
  if (!session) return new Response(null, { status: 401 });
  const { id } = await params;
  const ok = await deleteUploadImages(await getDb(), getBlobStore(), session.learner.id, id);
  return new Response(null, { status: ok ? 204 : 404 });
}
