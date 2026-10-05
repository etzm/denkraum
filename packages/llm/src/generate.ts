import { assertIdentityFree, type KnownIdentifiers } from "@denkraum/privacy";
import type { z } from "zod";
import type { LlmConfig } from "./config.ts";
import { renderTemplate, type LoadedPrompt, type TemplateVariables } from "./prompts.ts";
import type { CallStatus, ImageInput, LlmCallRecord, LlmProvider } from "./types.ts";

export interface StructuredRequest<T> {
  moduleId: string;
  prompt: LoadedPrompt;
  variables?: TemplateVariables;
  /**
   * The task data for the model (task text, solution, rubric, transcript). Modules type
   * this without any identity fields; it is sent as JSON in the user message.
   */
  input: unknown;
  images?: ImageInput[];
  schema: z.ZodType<T>;
  /** Everything that identifies the learner. The rendered prompt must contain none of it. */
  identity: KnownIdentifiers;
}

export interface Deps {
  provider: LlmProvider;
  config: LlmConfig;
  /** Persist the call log (llm_call table). Never receives content. */
  onCall?: (record: LlmCallRecord) => void | Promise<void>;
}

export type StructuredResult<T> =
  | { ok: true; data: T; promptName: string; promptVersion: number; model: string }
  | { ok: false; reason: Exclude<CallStatus, "ok">; promptName: string; promptVersion: number; detail: string };

const MAX_ATTEMPTS = 3;

function cost(config: LlmConfig, tier: LlmCallRecord["tier"], inputTokens: number, outputTokens: number): number | null {
  const price = config.prices[tier];
  return price ? (inputTokens * price[0] + outputTokens * price[1]) / 1_000_000 : null;
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError" || error.constructor.name === "APIUserAbortError");
}

/**
 * The only way modules talk to a model. It renders the versioned prompt, refuses to send
 * anything that identifies the learner, validates the answer against the schema, retries
 * once more with the validation error when the answer does not fit, and logs every call
 * without content. The caller decides what to do with a failure (for example offer typed
 * input); a refusal is never retried on another model.
 */
export async function generateStructured<T>(request: StructuredRequest<T>, deps: Deps): Promise<StructuredResult<T>> {
  const { prompt } = request;
  const tier = prompt.model_tier;
  const model = deps.config.models[tier];
  const system = renderTemplate(prompt.body, request.variables ?? {});
  const baseUserText = JSON.stringify(request.input, null, 2);
  assertIdentityFree(`${system}\n${baseUserText}`, request.identity);

  const failure = (reason: Exclude<CallStatus, "ok">, detail: string): StructuredResult<T> => ({
    ok: false,
    reason,
    promptName: prompt.name,
    promptVersion: prompt.version,
    detail,
  });

  let retryNote = "";
  let last: StructuredResult<T> = failure("error", "Kein Versuch.");
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const started = performance.now();
    const log = async (status: CallStatus, model: string, inputTokens = 0, outputTokens = 0) =>
      deps.onCall?.({
        moduleId: request.moduleId,
        promptName: prompt.name,
        promptVersion: prompt.version,
        tier,
        provider: deps.provider.name,
        model,
        attempt,
        status,
        inputTokens,
        outputTokens,
        latencyMs: Math.round(performance.now() - started),
        costUsd: cost(deps.config, tier, inputTokens, outputTokens),
      });

    let response;
    try {
      response = await deps.provider.complete({
        promptName: prompt.name,
        model,
        system,
        userText: baseUserText + retryNote,
        images: request.images ?? [],
        schema: request.schema,
        maxTokens: deps.config.maxTokens,
        signal: AbortSignal.timeout(deps.config.timeoutMs),
      });
    } catch (error) {
      const status = isAbort(error) ? "timeout" : "error";
      await log(status, model);
      return failure(status, error instanceof Error ? error.message : String(error));
    }

    if (response.stopReason === "refusal") {
      await log("refused", response.model, response.inputTokens, response.outputTokens);
      return failure("refused", "Das Modell hat die Anfrage abgelehnt.");
    }

    const parsed = request.schema.safeParse(response.json);
    if (parsed.success) {
      await log("ok", response.model, response.inputTokens, response.outputTokens);
      return { ok: true, data: parsed.data, promptName: prompt.name, promptVersion: prompt.version, model: response.model };
    }
    await log("schema_error", response.model, response.inputTokens, response.outputTokens);
    const issues = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "(Wurzel)"}: ${i.message}`);
    retryNote = `\n\nDeine vorige Antwort passte nicht zum Schema (${issues.join("; ")}). Antworte nur mit gültigem JSON nach dem Schema.`;
    last = failure("schema_error", issues.join("; "));
  }
  return last;
}
