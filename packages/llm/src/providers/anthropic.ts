import Anthropic from "@anthropic-ai/sdk";
import { AnthropicBedrockMantle } from "@anthropic-ai/bedrock-sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { LlmProvider, ProviderRequest, ProviderResponse } from "../types.ts";

type MessagesClient = Pick<Anthropic, "messages">;

function content(request: ProviderRequest): Anthropic.ContentBlockParam[] {
  const images: Anthropic.ImageBlockParam[] = request.images.map((image) => ({
    type: "image",
    source: { type: "base64", media_type: image.mediaType, data: image.data },
  }));
  return [...images, { type: "text", text: request.userText }];
}

function createProvider(name: string, client: MessagesClient): LlmProvider {
  return {
    name,
    async complete(request): Promise<ProviderResponse> {
      const response = await client.messages.parse(
        {
          model: request.model,
          max_tokens: request.maxTokens,
          system: request.system,
          messages: [{ role: "user", content: content(request) }],
          output_config: { format: zodOutputFormat(request.schema) },
        },
        { signal: request.signal },
      );
      return {
        // A refusal carries no usable content; generate.ts branches on stopReason first.
        json: response.stop_reason === "refusal" ? null : (response.parsed_output ?? null),
        stopReason: response.stop_reason ?? "unknown",
        model: response.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };
    },
  };
}

/** Direct Anthropic API: development with synthetic data only (config.ts enforces this). */
export function createAnthropicProvider(client: MessagesClient = new Anthropic()): LlmProvider {
  return createProvider("anthropic", client);
}

/** Claude on Amazon Bedrock in an EU region (production path, DECISIONS.md D-013). */
export function createBedrockProvider(awsRegion: string): LlmProvider {
  return createProvider("bedrock", new AnthropicBedrockMantle({ awsRegion }));
}
