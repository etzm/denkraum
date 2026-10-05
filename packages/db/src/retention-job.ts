import { and, eq, inArray, isNull, lte } from "drizzle-orm";
import { RETENTION_DEFAULTS } from "@denkraum/privacy";
import type { BlobStore } from "./blob-store.ts";
import type { Db } from "./client.ts";
import { groups, learners, llmCalls, sessions, uploads } from "./schema.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RetentionReport {
  photoUploads: number;
  groups: number;
  llmCalls: number;
  sessions: number;
}

/**
 * Deletes everything whose retention period is over (docs/datenschutz/README.md section 2).
 * Run daily. Safe to run repeatedly.
 */
export async function runRetention(db: Db, blobs: BlobStore, now: Date = new Date()): Promise<RetentionReport> {
  // 1. Photos: due date was computed per upload (platform default plus module override).
  const duePhotos = await db
    .select({ id: uploads.id, keys: uploads.storageKeys })
    .from(uploads)
    .where(and(lte(uploads.imagesDeleteAfter, now), isNull(uploads.imagesDeletedAt)));
  for (const upload of duePhotos) {
    await blobs.delete(upload.keys);
    await db.update(uploads).set({ storageKeys: [], imagesDeletedAt: now }).where(eq(uploads.id, upload.id));
  }

  // 2. Groups past their end: delete remaining blobs, then the group (cascades to all rows).
  const endedGroups = await db.select({ id: groups.id }).from(groups).where(lte(groups.endsAt, now));
  for (const group of endedGroups) {
    const leftover = await db
      .select({ keys: uploads.storageKeys })
      .from(uploads)
      .innerJoin(learners, eq(uploads.learnerId, learners.id))
      .where(eq(learners.groupId, group.id));
    await blobs.delete(leftover.flatMap((u) => u.keys));
    await db.delete(groups).where(eq(groups.id, group.id));
  }

  // 3. Model call log.
  const llmRule = RETENTION_DEFAULTS.llm_calls;
  const llmCutoff = new Date(now.getTime() - (llmRule === "group_end" ? 0 : llmRule.days) * DAY_MS);
  const deletedCalls = await db.delete(llmCalls).where(lte(llmCalls.createdAt, llmCutoff)).returning({ id: llmCalls.id });

  // 4. Expired sessions.
  const deletedSessions = await db.delete(sessions).where(lte(sessions.expiresAt, now)).returning({ id: sessions.id });

  return {
    photoUploads: duePhotos.length,
    groups: endedGroups.length,
    llmCalls: deletedCalls.length,
    sessions: deletedSessions.length,
  };
}

/** Right of access and portability (Art. 15, 20 GDPR): everything stored about one learner. */
export async function exportLearner(db: Db, learnerId: string) {
  const learner = await db.query.learners.findFirst({ where: eq(learners.id, learnerId) });
  if (!learner) return null;
  const learnerUploads = await db.query.uploads.findMany({ where: eq(uploads.learnerId, learnerId) });
  const uploadIds = learnerUploads.map((u) => u.id);
  const [learnerTranscripts, learnerFeedback] = uploadIds.length
    ? await Promise.all([
        db.query.transcripts.findMany({ where: (t) => inArray(t.uploadId, uploadIds) }),
        db.query.feedback.findMany({ where: (f) => inArray(f.uploadId, uploadIds) }),
      ])
    : [[], []];
  return { learner, uploads: learnerUploads, transcripts: learnerTranscripts, feedback: learnerFeedback };
}

/** Right to erasure (Art. 17 GDPR): deletes the learner, all rows and all photos. */
export async function deleteLearner(db: Db, blobs: BlobStore, learnerId: string): Promise<boolean> {
  const learnerUploads = await db.select({ keys: uploads.storageKeys }).from(uploads).where(eq(uploads.learnerId, learnerId));
  await blobs.delete(learnerUploads.flatMap((u) => u.keys));
  const deleted = await db.delete(learners).where(eq(learners.id, learnerId)).returning({ id: learners.id });
  return deleted.length > 0;
}
