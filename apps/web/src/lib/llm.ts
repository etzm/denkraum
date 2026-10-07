import { schema } from "@denkraum/db";
import { createProviderFromConfig, loadLlmConfig, type Deps, type MockFixture } from "@denkraum/llm";
import { mockFixtures as schreibwerkstattFixtures } from "@denkraum/mod-deutsch-schreibwerkstatt/fixtures";
import { getDb } from "./db.ts";

// One model client per server process, built on first use: loadLlmConfig() refuses invalid
// settings (for example the direct API in production), and that must not break `next build`.
const globalForLlm = globalThis as unknown as { denkraumLlm?: Deps };

/** Synthetic answers for LLM_PROVIDER=mock (development, CI, end-to-end tests). */
const MOCK_FIXTURES: Record<string, MockFixture> = { ...schreibwerkstattFixtures };

export function getLlm(): Deps {
  if (!globalForLlm.denkraumLlm) {
    const config = loadLlmConfig();
    globalForLlm.denkraumLlm = {
      config,
      provider: createProviderFromConfig(config, MOCK_FIXTURES),
      // The call log has ids, status and timing only, never content (docs/datenschutz/README.md section 8).
      onCall: async (record) => {
        await (await getDb()).insert(schema.llmCalls).values(record);
      },
    };
  }
  return globalForLlm.denkraumLlm;
}
