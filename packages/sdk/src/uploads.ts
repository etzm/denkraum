import type { ModuleManifest } from "@denkraum/core";
import { and, eq, isNull, schema, type BlobStore, type Db } from "@denkraum/db";
import type { ImageInput } from "@denkraum/llm";
import { deletionDueAt, findMetadataSegments, NotAJpegError, stripJpegMetadata } from "@denkraum/privacy";

export const MAX_PAGE_BYTES = 4 * 1024 * 1024;
export const DEFAULT_MAX_PAGES = 6;

export class UploadError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "UploadError";
    this.status = status;
  }
}

export interface UploadOwner {
  learnerId: string;
  groupEndsAt: Date;
}

export interface AcceptUploadInput {
  db: Db;
  blobs: BlobStore;
  owner: UploadOwner;
  manifest: ModuleManifest;
  kind: string;
  ref: string | null;
  maxPages: number;
  pages: Uint8Array[];
  now?: Date;
}

const pageKey = (uploadId: string, page: number) => `uploads/${uploadId}/${page}.jpg`;

/**
 * Stores photographed pages: JPEG only, metadata (EXIF, GPS, comments) removed, encrypted at rest
 * by the blob store, deletion date set from the platform rule plus module overrides.
 */
export async function acceptUpload(input: AcceptUploadInput): Promise<{ uploadId: string; pages: number }> {
  const { db, blobs, owner, manifest, pages } = input;
  const now = input.now ?? new Date();
  if (pages.length === 0) throw new UploadError("Kein Foto übermittelt.");
  if (pages.length > input.maxPages) throw new UploadError(`Höchstens ${input.maxPages} Fotos auf einmal.`);
  const cleaned = pages.map((bytes, i) => {
    if (bytes.length > MAX_PAGE_BYTES) throw new UploadError(`Foto ${i + 1} ist zu groß.`);
    try {
      const stripped = stripJpegMetadata(bytes);
      if (findMetadataSegments(stripped).length > 0) throw new UploadError("Foto enthält noch Metadaten.");
      return stripped;
    } catch (error) {
      if (error instanceof NotAJpegError) throw new UploadError(`Foto ${i + 1} ist kein JPEG.`);
      throw error;
    }
  });

  const imagesDeleteAfter = deletionDueAt("photos", { createdAt: now, groupEndsAt: owner.groupEndsAt }, manifest.retentionOverrides);
  const [row] = await db
    .insert(schema.uploads)
    .values({ learnerId: owner.learnerId, moduleId: manifest.id, kind: input.kind, ref: input.ref, imagesDeleteAfter, createdAt: now })
    .returning({ id: schema.uploads.id });
  const uploadId = row!.id;
  const keys: string[] = [];
  for (const [i, bytes] of cleaned.entries()) {
    const key = pageKey(uploadId, i + 1);
    await blobs.put(key, bytes, "image/jpeg");
    keys.push(key);
  }
  await db.update(schema.uploads).set({ storageKeys: keys }).where(eq(schema.uploads.id, uploadId));
  return { uploadId, pages: keys.length };
}

async function ownedUpload(db: Db, learnerId: string, uploadId: string) {
  const [row] = await db
    .select()
    .from(schema.uploads)
    .where(and(eq(schema.uploads.id, uploadId), eq(schema.uploads.learnerId, learnerId)));
  return row ?? null;
}

/** One page for display; null if it does not exist, belongs to someone else or is already deleted. */
export async function readUploadPage(db: Db, blobs: BlobStore, learnerId: string, uploadId: string, page: number) {
  const row = await ownedUpload(db, learnerId, uploadId);
  const key = row?.storageKeys[page - 1];
  if (!row || row.imagesDeletedAt || !key) return null;
  return blobs.get(key);
}

/** Deletes the photos of an upload right away (button "Fotos jetzt löschen"); transcripts stay. */
export async function deleteUploadImages(db: Db, blobs: BlobStore, learnerId: string, uploadId: string, now = new Date()) {
  const row = await ownedUpload(db, learnerId, uploadId);
  if (!row) return false;
  await blobs.delete(row.storageKeys);
  await db
    .update(schema.uploads)
    .set({ storageKeys: [], imagesDeletedAt: now })
    .where(and(eq(schema.uploads.id, uploadId), isNull(schema.uploads.imagesDeletedAt)));
  return true;
}

export interface UploadSummary {
  id: string;
  kind: string;
  ref: string | null;
  pages: number;
  createdAt: Date;
  imagesDeleteAfter: Date;
  imagesDeletedAt: Date | null;
}

/** What a module sees of uploads: only its own learner's, only its own module's. */
export interface ModuleUploads {
  /** Page URLs for <img>, served after an ownership check. */
  pageUrls(uploadId: string, pages: number): string[];
  get(uploadId: string): Promise<UploadSummary | null>;
  list(ref?: string): Promise<UploadSummary[]>;
  /** Decrypted pages as base64 JPEG for the vision model. */
  images(uploadId: string): Promise<ImageInput[]>;
  deleteImages(uploadId: string): Promise<boolean>;
}

export function createModuleUploads(db: Db, blobs: BlobStore, learnerId: string, moduleId: string): ModuleUploads {
  const summary = (row: typeof schema.uploads.$inferSelect): UploadSummary => ({
    id: row.id,
    kind: row.kind,
    ref: row.ref,
    pages: row.storageKeys.length,
    createdAt: row.createdAt,
    imagesDeleteAfter: row.imagesDeleteAfter,
    imagesDeletedAt: row.imagesDeletedAt,
  });
  const mine = (uploadId: string) =>
    and(eq(schema.uploads.id, uploadId), eq(schema.uploads.learnerId, learnerId), eq(schema.uploads.moduleId, moduleId));
  return {
    pageUrls: (uploadId, pages) => Array.from({ length: pages }, (_, i) => `/api/uploads/${uploadId}/pages/${i + 1}`),
    async get(uploadId) {
      const [row] = await db.select().from(schema.uploads).where(mine(uploadId));
      return row ? summary(row) : null;
    },
    async list(ref) {
      const rows = await db
        .select()
        .from(schema.uploads)
        .where(and(eq(schema.uploads.learnerId, learnerId), eq(schema.uploads.moduleId, moduleId), ref ? eq(schema.uploads.ref, ref) : undefined));
      return rows.map(summary);
    },
    async images(uploadId) {
      const [row] = await db.select().from(schema.uploads).where(mine(uploadId));
      if (!row || row.imagesDeletedAt) return [];
      const out: ImageInput[] = [];
      for (const key of row.storageKeys) {
        const bytes = await blobs.get(key);
        if (bytes) out.push({ mediaType: "image/jpeg", data: Buffer.from(bytes).toString("base64") });
      }
      return out;
    },
    deleteImages: (uploadId) => deleteUploadImages(db, blobs, learnerId, uploadId),
  };
}
