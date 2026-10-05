"use server";

import { redirect } from "next/navigation";
import { enterWithCode } from "@/lib/access.ts";
import { getDb } from "@/lib/db.ts";
import { endSession, startSession } from "@/lib/session.ts";

export async function enter(formData: FormData): Promise<void> {
  const result = await enterWithCode(await getDb(), String(formData.get("code") ?? ""));
  if (!result.ok) {
    // Slows down guessing; codes have about 850 billion combinations.
    await new Promise((resolve) => setTimeout(resolve, 400));
    redirect(`/?fehler=${result.error}`);
  }
  await startSession(result.learnerId);
  redirect(result.kind === "joined" ? "/willkommen" : "/m");
}

export async function leave(): Promise<void> {
  await endSession();
  redirect("/");
}
