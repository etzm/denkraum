import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createBlobStoreFromEnv, createEncryptingBlobStore, createFsBlobStore, createMemoryBlobStore } from "./index.ts";

const key = new Uint8Array(32).fill(7);
const photo = new Uint8Array([0xff, 0xd8, 1, 2, 3, 4, 0xff, 0xd9]);

describe("encrypting blob store", () => {
  it("stores only ciphertext and decrypts on read", async () => {
    const inner = createMemoryBlobStore();
    const store = createEncryptingBlobStore(inner, key);
    await store.put("uploads/u1/1.jpg", photo, "image/jpeg");
    const raw = inner.raw("uploads/u1/1.jpg")!;
    expect(Buffer.from(raw).includes(Buffer.from([1, 2, 3, 4]))).toBe(false);
    expect(raw.length).toBe(photo.length + 1 + 12 + 16);
    expect(await store.get("uploads/u1/1.jpg")).toEqual(photo);
    expect(await store.get("missing")).toBeNull();
  });

  it("rejects a wrong key and a swapped object", async () => {
    const inner = createMemoryBlobStore();
    await createEncryptingBlobStore(inner, key).put("a", photo, "image/jpeg");
    await expect(createEncryptingBlobStore(inner, new Uint8Array(32).fill(8)).get("a")).rejects.toThrow();
    await inner.put("b", inner.raw("a")!, "application/octet-stream");
    await expect(createEncryptingBlobStore(inner, key).get("b")).rejects.toThrow();
  });

  it("requires a 32 byte key", () => {
    expect(() => createEncryptingBlobStore(createMemoryBlobStore(), new Uint8Array(16))).toThrow();
  });
});

describe("file system blob store", () => {
  it("writes, reads, deletes and refuses path tricks", async () => {
    const store = createFsBlobStore(mkdtempSync(join(tmpdir(), "denkraum-blobs-")));
    await store.put("uploads/x/1.jpg", photo, "image/jpeg");
    expect(await store.get("uploads/x/1.jpg")).toEqual(photo);
    await store.delete(["uploads/x/1.jpg"]);
    expect(await store.get("uploads/x/1.jpg")).toBeNull();
    await expect(store.put("../evil", photo, "image/jpeg")).rejects.toThrow();
  });
});

describe("blob store from environment", () => {
  it("requires an encryption key in production", () => {
    expect(() => createBlobStoreFromEnv({ BLOB_STORE: "memory", NODE_ENV: "production" })).toThrow(/BLOB_ENCRYPTION_KEY/);
    expect(() => createBlobStoreFromEnv({ BLOB_STORE: "s3" })).toThrow(/S3_ENDPOINT/);
    expect(createBlobStoreFromEnv({ BLOB_STORE: "memory" })).toBeDefined();
  });
});
