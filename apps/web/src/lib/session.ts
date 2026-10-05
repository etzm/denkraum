import { cookies } from "next/headers";
import { getDb } from "./db.ts";
import { createSession, deleteSession, findLearnerBySession, SESSION_DAYS } from "./access.ts";

const COOKIE = "dr_session";

/** The only cookie of the app: technically necessary, httpOnly, no tracking. */
export async function startSession(learnerId: string): Promise<void> {
  const token = await createSession(await getDb(), learnerId);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
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
