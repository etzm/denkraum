import { DeleteObjectsCommand, GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { BlobStore } from "./blob-store.ts";

export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** S3-compatible object storage, for example Hetzner Object Storage in Germany (DECISIONS.md, D-016). */
export function createS3BlobStore(config: S3Config): BlobStore {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  return {
    async put(key, data, contentType) {
      await client.send(new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: data, ContentType: contentType }));
    },
    async get(key) {
      try {
        const result = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
        return result.Body ? new Uint8Array(await result.Body.transformToByteArray()) : null;
      } catch (error) {
        if (error instanceof NoSuchKey) return null;
        throw error;
      }
    },
    async delete(keys) {
      for (let i = 0; i < keys.length; i += 1000) {
        const chunk = keys.slice(i, i + 1000);
        if (chunk.length === 0) continue;
        await client.send(new DeleteObjectsCommand({ Bucket: config.bucket, Delete: { Objects: chunk.map((Key) => ({ Key })) } }));
      }
    },
  };
}
