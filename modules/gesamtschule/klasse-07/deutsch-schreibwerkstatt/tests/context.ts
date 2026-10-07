// Test context for the mission engine: an in-memory database with all migrations and a
// ModuleContext like the platform builds it, with the module's mock fixtures as model.
// Synthetic data only (docs/datenschutz/README.md, section 7).

import { createModuleAi, createModuleUploads, type ModuleContext } from "@denkraum/sdk";
import { learners } from "@denkraum/sdk/db";
// The SDK has no test helper for a database yet; the platform client is imported by path (test only).
import { connectDb, createMemoryBlobStore, schema } from "@denkraum/sdk/testing";
import { MOCK_FIXTURES } from "../mission/mocks.ts";
import { manifest } from "../module.ts";
import { PROMPTS } from "../prompts/index.ts";

type AiDeps = Parameters<typeof createModuleAi>[0];
type Provider = AiDeps["provider"];
type ProviderRequest = Parameters<Provider["complete"]>[0];

export const PSEUDONYM = "Grüner Fuchs 17";
export const PERSONAL_CODE = "TEST-K7AB";
export const JOIN_CODE = "TEST-GRP7";

/** Answers like the platform mock provider; `override` replaces single prompts. */
export function fixtureProvider(
  override: Partial<Record<string, (request: ProviderRequest) => { json: unknown; stopReason?: string } | "throw" | undefined>> = {},
): Provider & { calls: string[] } {
  const calls: string[] = [];
  return {
    name: "mock",
    calls,
    async complete(request) {
      calls.push(request.promptName);
      const custom = override[request.promptName]?.(request);
      if (custom === "throw") throw new Error("network down");
      const fixture = MOCK_FIXTURES[request.promptName as keyof typeof MOCK_FIXTURES];
      const json = custom ? custom.json : fixture(request);
      return { json, stopReason: custom?.stopReason ?? "end_turn", model: "mock", inputTokens: 0, outputTokens: 0 };
    },
  };
}

export async function createTestContext(provider: Provider = fixtureProvider(), niveauEEnabled = false) {
  const db = await connectDb("pglite:memory");
  const endsAt = new Date("2027-07-31T00:00:00Z");
  const [group] = await db
    .insert(schema.groups)
    .values({ kind: "individual", label: "Test 7", schulart: "gesamtschule", klasse: 7, joinCode: JOIN_CODE, endsAt })
    .returning();
  const [learner] = await db
    .insert(learners)
    .values({ groupId: group!.id, pseudonym: PSEUDONYM, personalCode: PERSONAL_CODE, niveauEEnabled })
    .returning();
  const config: AiDeps["config"] = {
    provider: "mock",
    models: { vision: "mock", hard: "mock", light: "mock" },
    awsRegion: undefined,
    baseUrl: undefined,
    apiKey: undefined,
    timeoutMs: 5000,
    maxTokens: 4000,
    prices: {},
  };
  const ctx: ModuleContext = {
    manifest,
    learner: { id: learner!.id, niveau: "M", niveauEEnabled },
    group: { id: group!.id, schulart: "gesamtschule", klasse: 7, endsAt },
    basePath: "/klasse7/m/deutsch-schreibwerkstatt",
    db,
    ai: createModuleAi({
      moduleId: manifest.id,
      prompts: PROMPTS,
      provider,
      config,
      identity: { pseudonym: PSEUDONYM, accessCodes: [PERSONAL_CODE, JOIN_CODE], ids: [learner!.id, group!.id] },
      db,
    }),
    uploads: createModuleUploads(db, createMemoryBlobStore(), learner!.id, manifest.id),
    action: () => async () => {},
    now: new Date("2026-10-07T10:00:00Z"),
  };
  return { ctx, db };
}

/** FormData from a plain object; arrays become repeated fields. */
export function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) data.append(key, v);
  }
  return data;
}
