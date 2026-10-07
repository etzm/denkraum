import type { LlmTier } from "@denkraum/core";
import { schema as dbSchema, type Db } from "@denkraum/db";
import {
  generateStructured,
  parsePromptFile,
  type ImageInput,
  type LlmCallRecord,
  type LlmConfig,
  type LlmProvider,
  type LoadedPrompt,
  type StructuredResult,
  type TemplateVariables,
} from "@denkraum/llm";
import type { KnownIdentifiers } from "@denkraum/privacy";
import type { z } from "zod";

export interface ModuleAiRequest<T> {
  /** Prompt name; the highest version is used unless `version` is given. */
  prompt: string;
  version?: number;
  variables?: TemplateVariables;
  /** Task data for the model. Must not contain anything about the learner's identity. */
  input: unknown;
  images?: ImageInput[];
  schema: z.ZodType<T>;
}

export interface ModuleAi {
  generate<T>(request: ModuleAiRequest<T>): Promise<StructuredResult<T>>;
  prompt(name: string, version?: number): LoadedPrompt;
  /** Tier and model actually configured, for showing "KI-Rückmeldung" with the model name. */
  model(tier: LlmTier): string;
}

/** Picks a prompt from the embedded files: a given version or the highest. */
export function pickPrompt(files: Record<string, string>, name: string, version?: number): LoadedPrompt {
  const versions = Object.keys(files)
    .map((file) => new RegExp(`^${name}\\.v(\\d+)\\.md$`).exec(file))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]));
  if (versions.length === 0) throw new Error(`Kein Prompt "${name}".`);
  const chosen = version ?? Math.max(...versions);
  const file = `${name}.v${chosen}.md`;
  if (!(file in files)) throw new Error(`Prompt "${name}" v${chosen} fehlt.`);
  return parsePromptFile(files[file]!, file);
}

export interface ModuleAiDeps {
  moduleId: string;
  prompts: Record<string, string>;
  provider: LlmProvider;
  config: LlmConfig;
  /** Everything that identifies the learner; the guard refuses prompts that contain it. */
  identity: KnownIdentifiers;
  db: Db | null;
}

/** Module view on the model layer: identity guard, prompt versions and the call log are filled in. */
export function createModuleAi(deps: ModuleAiDeps): ModuleAi {
  const log = async (record: LlmCallRecord) => {
    if (!deps.db) return;
    await deps.db.insert(dbSchema.llmCalls).values({
      moduleId: record.moduleId,
      promptName: record.promptName,
      promptVersion: record.promptVersion,
      tier: record.tier,
      provider: record.provider,
      model: record.model,
      attempt: record.attempt,
      status: record.status,
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      latencyMs: record.latencyMs,
      costUsd: record.costUsd,
    });
  };
  return {
    prompt: (name, version) => pickPrompt(deps.prompts, name, version),
    model: (tier) => deps.config.models[tier],
    generate(request) {
      return generateStructured(
        {
          moduleId: deps.moduleId,
          prompt: pickPrompt(deps.prompts, request.prompt, request.version),
          variables: request.variables,
          input: request.input,
          images: request.images,
          schema: request.schema,
          identity: deps.identity,
        },
        { provider: deps.provider, config: deps.config, onCall: log },
      );
    },
  };
}
