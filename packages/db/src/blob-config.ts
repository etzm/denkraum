import { createHash } from "node:crypto";
import { createEncryptingBlobStore, createFsBlobStore, createMemoryBlobStore, type BlobStore } from "./blob-store.ts";
import { createS3BlobStore } from "./s3-store.ts";

/**
 * BLOB_STORE: "fs" (default, BLOB_DIR), "s3" (S3_* variables) or "memory" (tests).
 * BLOB_ENCRYPTION_KEY: 32 bytes as base64. Required in production; development falls back
 * to a fixed, public key so local data stays readable across restarts.
 */
export function createBlobStoreFromEnv(env: Record<string, string | undefined> = process.env): BlobStore {
  const kind = env.BLOB_STORE ?? "fs";
  let inner: BlobStore;
  if (kind === "memory") inner = createMemoryBlobStore();
  else if (kind === "fs") inner = createFsBlobStore(env.BLOB_DIR ?? "./.data/blobs");
  else if (kind === "s3") {
    const need = (name: string) => {
      const value = env[name];
      if (!value) throw new Error(`${name} fehlt für BLOB_STORE=s3.`);
      return value;
    };
    inner = createS3BlobStore({
      endpoint: need("S3_ENDPOINT"),
      region: env.S3_REGION ?? "eu-central",
      bucket: need("S3_BUCKET"),
      accessKeyId: need("S3_ACCESS_KEY_ID"),
      secretAccessKey: need("S3_SECRET_ACCESS_KEY"),
    });
  } else throw new Error(`Unbekannter BLOB_STORE "${kind}".`);

  const configured = env.BLOB_ENCRYPTION_KEY;
  if (!configured && env.NODE_ENV === "production") throw new Error("BLOB_ENCRYPTION_KEY fehlt.");
  const key = configured
    ? new Uint8Array(Buffer.from(configured, "base64"))
    : new Uint8Array(createHash("sha256").update("denkraum-development-only").digest());
  return createEncryptingBlobStore(inner, key);
}
