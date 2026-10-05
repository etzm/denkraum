/** Object storage for photos. P1 adds an S3 implementation for the private EU bucket. */
export interface BlobStore {
  put(key: string, data: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(keys: readonly string[]): Promise<void>;
}

export function createMemoryBlobStore(): BlobStore & { keys(): string[] } {
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
  };
}
