import { createProviderFromConfig, loadLlmConfig, type LlmConfig, type LlmProvider, type MockFixture } from "@denkraum/llm";
import { createModuleAi, createModuleUploads, type ModuleContext, type ModuleDefinition } from "@denkraum/sdk";
import { runModuleAction } from "@/app/module-actions.ts";
import { slugForKlasse } from "./classes.ts";
import { getBlobStore, getDb } from "./db.ts";
import { DEFINITIONS } from "./modules.ts";
import type { currentLearner } from "./session.ts";

type Session = NonNullable<Awaited<ReturnType<typeof currentLearner>>>;

const globalForLlm = globalThis as unknown as { denkraumLlm?: { config: LlmConfig; provider: LlmProvider } };

/** Model access for all modules. Swapping models is configuration (LLM_PROVIDER, MODEL_*), see .env.example. */
export function getLlm(): { config: LlmConfig; provider: LlmProvider } {
  if (!globalForLlm.denkraumLlm) {
    const config = loadLlmConfig();
    const fixtures: Record<string, MockFixture> = Object.assign({}, ...DEFINITIONS.map((d) => d.mockFixtures ?? {}));
    globalForLlm.denkraumLlm = { config, provider: createProviderFromConfig(config, fixtures) };
  }
  return globalForLlm.denkraumLlm;
}

export async function buildModuleContext(definition: ModuleDefinition, session: Session): Promise<ModuleContext> {
  const db = await getDb();
  const { learner, group } = session;
  const klasse = slugForKlasse(group.klasse);
  const llm = getLlm();
  return {
    manifest: definition.manifest,
    learner: { id: learner.id, niveau: learner.niveau, niveauEEnabled: learner.niveauEEnabled },
    group: { id: group.id, schulart: group.schulart, klasse: group.klasse, endsAt: group.endsAt },
    basePath: `/${klasse}/m/${definition.manifest.id}`,
    db,
    ai: createModuleAi({
      moduleId: definition.manifest.id,
      prompts: definition.prompts ?? {},
      provider: llm.provider,
      config: llm.config,
      identity: { pseudonym: learner.pseudonym, accessCodes: [learner.personalCode, group.joinCode], ids: [learner.id, group.id] },
      db,
    }),
    uploads: createModuleUploads(db, getBlobStore(), learner.id, definition.manifest.id),
    action: (name) => runModuleAction.bind(null, definition.manifest.id, name),
    now: new Date(),
  };
}
