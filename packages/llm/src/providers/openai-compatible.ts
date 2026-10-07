import { z } from "zod";
import type { LlmProvider, ProviderRequest, ProviderResponse } from "../types.ts";

/**
 * Any endpoint that speaks the OpenAI chat completions format: vLLM, LiteLLM, Ollama or an
 * EU-hosted open-weights service (for example Qwen-VL). Swapping models is configuration only
 * (DECISIONS.md, D-004). Raw HTTP on purpose: no vendor SDK for a generic protocol.
 */
export interface OpenAiCompatibleOptions {
  baseUrl: string;
  apiKey?: string;
  fetch?: typeof fetch;
}

interface ChatCompletion {
  model?: string;
  choices?: Array<{ finish_reason?: string; message?: { content?: string | null; refusal?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export function createOpenAiCompatibleProvider(options: OpenAiCompatibleOptions): LlmProvider {
  const doFetch = options.fetch ?? fetch;
  const url = `${options.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  return {
    name: "openai-compatible",
    async complete(request: ProviderRequest): Promise<ProviderResponse> {
      const content = [
        ...request.images.map((image) => ({ type: "image_url", image_url: { url: `data:${image.mediaType};base64,${image.data}` } })),
        { type: "text", text: request.userText },
      ];
      const response = await doFetch(url, {
        method: "POST",
        signal: request.signal,
        headers: { "content-type": "application/json", ...(options.apiKey ? { authorization: `Bearer ${options.apiKey}` } : {}) },
        body: JSON.stringify({
          model: request.model,
          max_tokens: request.maxTokens,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: request.promptName, strict: true, schema: z.toJSONSchema(request.schema, { target: "draft-7" }) },
          },
        }),
      });
      if (!response.ok) throw new Error(`Modell-Endpunkt antwortet mit ${response.status}.`);
      const body = (await response.json()) as ChatCompletion;
      const choice = body.choices?.[0];
      const refused = Boolean(choice?.message?.refusal) || choice?.finish_reason === "content_filter";
      let json: unknown = null;
      if (!refused && choice?.message?.content) {
        try {
          json = JSON.parse(choice.message.content);
        } catch {
          json = null;
        }
      }
      return {
        json,
        stopReason: refused ? "refusal" : (choice?.finish_reason ?? "unknown"),
        model: body.model ?? request.model,
        inputTokens: body.usage?.prompt_tokens ?? 0,
        outputTokens: body.usage?.completion_tokens ?? 0,
      };
    },
  };
}
