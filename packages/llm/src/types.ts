import type { LlmTier } from "@denkraum/core";
import type { z } from "zod";

export interface ImageInput {
  mediaType: "image/jpeg" | "image/png";
  /** Base64 without data-URL prefix. */
  data: string;
}

/** What a provider receives. Never contains learner identity (see generate.ts). */
export interface ProviderRequest {
  /** Prompt name, used by the mock provider to pick a fixture. Not sent to any model. */
  promptName: string;
  model: string;
  system: string;
  userText: string;
  images: ImageInput[];
  schema: z.ZodType;
  maxTokens: number;
  signal: AbortSignal;
}

export interface ProviderResponse {
  /** Parsed JSON, or null when the model returned no parseable JSON. */
  json: unknown;
  stopReason: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface LlmProvider {
  readonly name: string;
  complete(request: ProviderRequest): Promise<ProviderResponse>;
}

export type CallStatus = "ok" | "schema_error" | "refused" | "timeout" | "error";

/**
 * Logged for every model call. Deliberately without any content: no prompt, no answer,
 * no learner id. See docs/datenschutz/README.md sections 2 and 8.
 */
export interface LlmCallRecord {
  moduleId: string;
  promptName: string;
  promptVersion: number;
  tier: LlmTier;
  provider: string;
  model: string;
  attempt: number;
  status: CallStatus;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costUsd: number | null;
}
