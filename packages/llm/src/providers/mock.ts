import type { LlmProvider, ProviderRequest, ProviderResponse } from "../types.ts";

/** Deterministic answers for CI and local development: no API key, no network, no data leaves. */
export type MockFixture = (request: ProviderRequest) => unknown;

export function createMockProvider(fixtures: Record<string, MockFixture>): LlmProvider {
  return {
    name: "mock",
    async complete(request): Promise<ProviderResponse> {
      const fixture = fixtures[request.promptName];
      if (!fixture) throw new Error(`Keine Mock-Antwort für Prompt "${request.promptName}".`);
      return { json: fixture(request), stopReason: "end_turn", model: "mock", inputTokens: 0, outputTokens: 0 };
    },
  };
}
