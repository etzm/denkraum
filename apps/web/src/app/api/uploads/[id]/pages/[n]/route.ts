import { readUploadPage } from "@denkraum/sdk";
import { getBlobStore, getDb } from "@/lib/db.ts";
import { currentLearner } from "@/lib/session.ts";

/** One photographed page, decrypted, only for its owner and never cached. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; n: string }> }): Promise<Response> {
  const session = await currentLearner();
  if (!session) return new Response(null, { status: 401 });
  const { id, n } = await params;
  const page = Number(n);
  if (!Number.isInteger(page) || page < 1) return new Response(null, { status: 404 });
  const bytes = await readUploadPage(await getDb(), getBlobStore(), session.learner.id, id, page);
  if (!bytes) return new Response(null, { status: 404 });
  return new Response(Buffer.from(bytes), {
    headers: { "content-type": "image/jpeg", "cache-control": "private, no-store", "x-content-type-options": "nosniff" },
  });
}
