import { cookies } from "next/headers";
import { getDb } from "./db.ts";
import { createSession, createViewerSession, deleteSession, findLearnerBySession, findViewerBySession, SESSION_DAYS } from "./access.ts";

const COOKIE = "dr_session";

/** The only cookie of the app: technically necessary, httpOnly, no tracking. */
async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function startSession(learnerId: string): Promise<void> {
  await setSessionCookie(await createSession(await getDb(), learnerId));
}

/** A teacher signs in with the teacher code of the group (DECISIONS.md D-017). */
export async function startViewerSession(viewerId: string): Promise<void> {
  await setSessionCookie(await createViewerSession(await getDb(), viewerId));
}

export async function currentViewer() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  return findViewerBySession(await getDb(), token);
}

export async function currentLearner() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  return findLearnerBySession(await getDb(), token);
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await deleteSession(await getDb(), token);
  jar.delete(COOKIE);
}
