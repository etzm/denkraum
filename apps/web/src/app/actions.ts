"use server";

import { redirect } from "next/navigation";
import { enterWithCode } from "@/lib/access.ts";
import { canonicalSlug, slugForKlasse } from "@/lib/classes.ts";
import { getDb } from "@/lib/db.ts";
import { endSession, startSession } from "@/lib/session.ts";

export async function enter(formData: FormData): Promise<void> {
  const slug = canonicalSlug(String(formData.get("klasse") ?? "")) ?? "";
  const result = await enterWithCode(await getDb(), String(formData.get("code") ?? ""));
  if (!result.ok) {
    // Slows down guessing; codes have about 850 billion combinations.
    await new Promise((resolve) => setTimeout(resolve, 400));
    redirect(`/${slug}?fehler=${result.error}`);
  }
  await startSession(result.learnerId);
  // A code always leads to its own class, whichever class page it was typed on.
  const target = slugForKlasse(result.klasse);
  redirect(result.kind === "joined" ? `/${target}/willkommen` : `/${target}`);
}

export async function leave(formData: FormData): Promise<void> {
  await endSession();
  redirect(`/${canonicalSlug(String(formData.get("klasse") ?? "")) ?? ""}`);
}
