"use server";

import { redirect } from "next/navigation";
import { enterWithCode } from "@/lib/access.ts";
import { canonicalSlug, slugForKlasse } from "@/lib/classes.ts";
import { getDb } from "@/lib/db.ts";
import { endSession, startSession, startViewerSession } from "@/lib/session.ts";

export async function enter(formData: FormData): Promise<void> {
  const slug = canonicalSlug(String(formData.get("klasse") ?? "")) ?? "";
  const result = await enterWithCode(await getDb(), String(formData.get("code") ?? ""));
  if (!result.ok) {
    // Slows down guessing; codes have about 850 billion combinations.
    await new Promise((resolve) => setTimeout(resolve, 400));
    redirect(`/${slug}?fehler=${result.error}`);
  }
  // A code always leads to its own class, whichever class page it was typed on.
  const target = slugForKlasse(result.klasse);
  if (result.kind === "teacher") {
    await startViewerSession(result.viewerId);
    redirect(`/${target}/lehrkraft`);
  }
  await startSession(result.learnerId);
  redirect(result.kind === "joined" ? `/${target}/willkommen` : `/${target}`);
}

export async function leave(formData: FormData): Promise<void> {
  await endSession();
  redirect(`/${canonicalSlug(String(formData.get("klasse") ?? "")) ?? ""}`);
}

export async function deletePhotos(formData: FormData): Promise<void> {
  const { deleteUploadImages } = await import("@denkraum/sdk");
  const { currentLearner } = await import("@/lib/session.ts");
  const { getBlobStore } = await import("@/lib/db.ts");
  const session = await currentLearner();
  if (!session) redirect("/");
  await deleteUploadImages(await getDb(), getBlobStore(), session.learner.id, String(formData.get("upload") ?? ""));
  redirect(`/${slugForKlasse(session.group.klasse)}/fotos?geloescht=1`);
}
