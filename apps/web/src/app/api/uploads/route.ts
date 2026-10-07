import { acceptUpload, DEFAULT_MAX_PAGES, MAX_PAGE_BYTES, UploadError } from "@denkraum/sdk";
import { getBlobStore, getDb } from "@/lib/db.ts";
import { findDefinition } from "@/lib/modules.ts";
import { currentLearner } from "@/lib/session.ts";

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

/** Photo upload: session required, module and kind must belong to the learner's class. */
export async function POST(request: Request): Promise<Response> {
  const session = await currentLearner();
  if (!session) return json(401, { error: "Bitte melde dich zuerst an." });
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > DEFAULT_MAX_PAGES * 2 * MAX_PAGE_BYTES) return json(413, { error: "Die Fotos sind zu groß." });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, { error: "Ungültige Anfrage." });
  }
  const definition = findDefinition(String(form.get("module") ?? ""));
  const manifest = definition?.manifest;
  if (!definition || !manifest || manifest.klasse !== session.group.klasse || manifest.schulart !== session.group.schulart) {
    return json(404, { error: "Unbekanntes Modul." });
  }
  const kind = String(form.get("kind") ?? "");
  const limits = definition.uploadKinds?.[kind];
  if (!limits) return json(400, { error: "Unbekannte Art von Upload." });
  const ref = form.get("ref");
  const files = form.getAll("pages").filter((f): f is File => f instanceof File);
  try {
    const pages = await Promise.all(files.map(async (f) => new Uint8Array(await f.arrayBuffer())));
    const result = await acceptUpload({
      db: await getDb(),
      blobs: getBlobStore(),
      owner: { learnerId: session.learner.id, groupEndsAt: session.group.endsAt },
      manifest,
      kind,
      ref: typeof ref === "string" && ref.length > 0 ? ref.slice(0, 64) : null,
      maxPages: limits.maxPages,
      pages,
    });
    return json(201, result);
  } catch (error) {
    if (error instanceof UploadError) return json(error.status, { error: error.message });
    throw error;
  }
}
