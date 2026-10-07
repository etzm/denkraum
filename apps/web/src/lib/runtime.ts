import { createMockProvider, createProviderFromConfig, loadLlmConfig, type LlmConfig, type LlmProvider } from "@denkraum/llm";
import { asc, eq, schema } from "@denkraum/db";
import { createModuleAi, createModuleUploads, type ModuleContext, type ModuleDefinition, type TeacherContext } from "@denkraum/sdk";
import { runModuleAction } from "@/app/module-actions.ts";
import { runTeacherAction } from "@/app/teacher-actions.ts";
import { slugForKlasse } from "./classes.ts";
import { getBlobStore, getDb } from "./db.ts";
import type { currentLearner, currentViewer } from "./session.ts";

type Session = NonNullable<Awaited<ReturnType<typeof currentLearner>>>;
type ViewerSession = NonNullable<Awaited<ReturnType<typeof currentViewer>>>;

const globalForLlm = globalThis as unknown as { denkraumLlm?: { config: LlmConfig; provider: LlmProvider } };

/** Model access for all modules. Swapping models is configuration (LLM_PROVIDER, MODEL_*), see .env.example. */
export function getLlm(): { config: LlmConfig; provider: LlmProvider } {
  if (!globalForLlm.denkraumLlm) {
    const config = loadLlmConfig();
    globalForLlm.denkraumLlm = { config, provider: createProviderFromConfig(config) };
  }
  return globalForLlm.denkraumLlm;
}

export async function buildModuleContext(definition: ModuleDefinition, session: Session): Promise<ModuleContext> {
  const db = await getDb();
  const { learner, group } = session;
  const klasse = slugForKlasse(group.klasse);
  const llm = getLlm();
  // With the mock provider every module answers from its own fixtures, so prompt names cannot collide.
  const provider = llm.config.provider === "mock" ? createMockProvider(definition.mockFixtures ?? {}) : llm.provider;
  return {
    manifest: definition.manifest,
    learner: { id: learner.id, niveau: learner.niveau, niveauEEnabled: learner.niveauEEnabled },
    group: { id: group.id, schulart: group.schulart, klasse: group.klasse, endsAt: group.endsAt },
    basePath: `/${klasse}/m/${definition.manifest.id}`,
    db,
    ai: createModuleAi({
      moduleId: definition.manifest.id,
      prompts: definition.prompts ?? {},
      provider,
      config: llm.config,
      identity: { pseudonym: learner.pseudonym, accessCodes: [learner.personalCode, group.joinCode], ids: [learner.id, group.id] },
      db,
    }),
    uploads: createModuleUploads(db, getBlobStore(), learner.id, definition.manifest.id),
    action: (name) => runModuleAction.bind(null, definition.manifest.id, name),
    now: new Date(),
  };
}

/** Context of a module's teacher view: the group and its pseudonyms, no model access, no photos. */
export async function buildTeacherContext(definition: ModuleDefinition, session: ViewerSession): Promise<TeacherContext> {
  const db = await getDb();
  const { viewer, group } = session;
  const learners = await db
    .select({ id: schema.learners.id, pseudonym: schema.learners.pseudonym })
    .from(schema.learners)
    .where(eq(schema.learners.groupId, group.id))
    .orderBy(asc(schema.learners.pseudonym));
  return {
    manifest: definition.manifest,
    viewer: { id: viewer.id },
    group: { id: group.id, label: group.label, schulart: group.schulart, klasse: group.klasse, endsAt: group.endsAt },
    learners,
    basePath: `/${slugForKlasse(group.klasse)}/lehrkraft/m/${definition.manifest.id}`,
    db,
    action: (name) => runTeacherAction.bind(null, definition.manifest.id, name),
    now: new Date(),
  };
}
