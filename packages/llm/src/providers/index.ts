import type { LlmConfig } from "../config.ts";
import type { LlmProvider } from "../types.ts";
import { createAnthropicProvider, createBedrockProvider } from "./anthropic.ts";
import { createMockProvider, type MockFixture } from "./mock.ts";

export { createAnthropicProvider, createBedrockProvider, createMockProvider };
export type { MockFixture };

export function createProviderFromConfig(config: LlmConfig, mockFixtures: Record<string, MockFixture> = {}): LlmProvider {
  switch (config.provider) {
    case "mock":
      return createMockProvider(mockFixtures);
    case "anthropic":
      return createAnthropicProvider();
    case "bedrock":
      return createBedrockProvider(config.awsRegion!);
  }
}
