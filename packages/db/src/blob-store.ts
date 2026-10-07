import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";

/** Object storage for photos (docs/datenschutz/README.md section 4). */
export interface BlobStore {
  put(key: string, data: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(keys: readonly string[]): Promise<void>;
}

export function createMemoryBlobStore(): BlobStore & { keys(): string[]; raw(key: string): Uint8Array | undefined } {
  const store = new Map<string, Uint8Array>();
  return {
    async put(key, data) {
      store.set(key, data);
    },
    async get(key) {
      return store.get(key) ?? null;
    },
    async delete(keys) {
      for (const key of keys) store.delete(key);
    },
    keys: () => [...store.keys()],
    raw: (key) => store.get(key),
  };
}

const KEY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/;

function safeKey(key: string): string {
  if (!KEY_PATTERN.test(key) || key.includes("..")) throw new Error(`Ungültiger Speicherschlüssel: ${key}`);
  return key;
}

/** Local directory, for one server without object storage (and for development). */
export function createFsBlobStore(root: string): BlobStore {
  const path = (key: string) => normalize(join(root, safeKey(key)));
  return {
    async put(key, data) {
      const file = path(key);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, data, { mode: 0o600 });
    },
    async get(key) {
      try {
        return new Uint8Array(await readFile(path(key)));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    async delete(keys) {
      await Promise.all(keys.map((key) => rm(path(key), { force: true })));
    },
  };
}

const VERSION = 1;
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Encrypts every object with AES-256-GCM before it reaches the underlying store, so the
 * storage provider never sees a photo (DECISIONS.md, D-016). The key never leaves the app server.
 * Layout: version (1 byte) | IV (12) | ciphertext | auth tag (16). The object key is bound as
 * additional authenticated data, so an object cannot be swapped for another one.
 */
export function createEncryptingBlobStore(inner: BlobStore, key: Uint8Array): BlobStore {
  if (key.length !== 32) throw new Error("Der Schlüssel für die Foto-Verschlüsselung muss 32 Bytes lang sein.");
  return {
    async put(objectKey, data, contentType) {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      cipher.setAAD(Buffer.from(objectKey));
      const body = Buffer.concat([cipher.update(data), cipher.final()]);
      const out = Buffer.concat([Buffer.from([VERSION]), iv, body, cipher.getAuthTag()]);
      await inner.put(objectKey, new Uint8Array(out), "application/octet-stream");
      void contentType;
    },
    async get(objectKey) {
      const stored = await inner.get(objectKey);
      if (!stored) return null;
      const buf = Buffer.from(stored);
      if (buf[0] !== VERSION || buf.length < 1 + IV_BYTES + TAG_BYTES) throw new Error("Unbekanntes Format im Fotospeicher.");
      const iv = buf.subarray(1, 1 + IV_BYTES);
      const tag = buf.subarray(buf.length - TAG_BYTES);
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAAD(Buffer.from(objectKey));
      decipher.setAuthTag(tag);
      return new Uint8Array(Buffer.concat([decipher.update(buf.subarray(1 + IV_BYTES, buf.length - TAG_BYTES)), decipher.final()]));
    },
    delete: (keys) => inner.delete(keys),
  };
}
