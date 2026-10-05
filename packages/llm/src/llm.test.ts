import { describe, expect, it } from "vitest";
import { z } from "zod";
import { IdentityLeakError } from "@denkraum/privacy";
import {
  createAnthropicProvider,
  createMockProvider,
  generateStructured,
  loadLlmConfig,
  LlmConfigError,
  parsePromptFile,
  renderTemplate,
  type LlmCallRecord,
  type LlmProvider,
  type ProviderRequest,
} from "./index.ts";

const PROMPT_SOURCE = `---
name: text_review
version: 2
model_tier: hard
output_schema: textReview
---
Du bist Schreibcoach für Klasse 7.
{{#if niveau_e_enabled}}Bewerte auch die E-Bonuskriterien.{{/if}}
Aufgabe: {{task}}`;

const schema = z.object({ next_step: z.string().min(5), stars: z.number().int().min(0).max(3) });
const prompt = parsePromptFile(PROMPT_SOURCE, "prompts/text_review.v2.md");
const config = loadLlmConfig({ LLM_PROVIDER: "mock", LLM_PRICE_HARD: "2,10" });
const identity = { pseudonym: "Blauer Falke 42", accessCodes: ["K7QM-X2PA"] };

function request(input: unknown = { text: "Handys lenken ab." }) {
  return {
    moduleId: "deutsch-schreibwerkstatt",
    prompt,
    variables: { niveau_e_enabled: false, task: "Stellungnahme" },
    input,
    schema,
    identity,
  };
}

describe("prompt files", () => {
  it("parses frontmatter and checks the file name", () => {
    expect(prompt).toMatchObject({ name: "text_review", version: 2, model_tier: "hard" });
    expect(() => parsePromptFile(PROMPT_SOURCE, "text_review.v1.md")).toThrow();
  });

  it("renders variables and conditionals, rejects unknown variables", () => {
    expect(renderTemplate("A {{x}} {{#if e}}E{{/if}}", { x: 1, e: true })).toBe("A 1 E");
    expect(renderTemplate("{{#if e}}E{{/if}}", { e: false })).toBe("");
    expect(() => renderTemplate("{{missing}}", {})).toThrow(/missing/);
  });
});

describe("config", () => {
  it("defaults to the mock provider", () => {
    expect(loadLlmConfig({}).provider).toBe("mock");
  });

  it("allows Bedrock only in an EU region", () => {
    expect(() => loadLlmConfig({ LLM_PROVIDER: "bedrock", AWS_REGION: "us-east-1" })).toThrow(LlmConfigError);
    const eu = loadLlmConfig({ LLM_PROVIDER: "bedrock", AWS_REGION: "eu-central-1" });
    expect(eu.models.vision).toBe("anthropic.claude-sonnet-5-5");
  });

  it("blocks the direct API in production", () => {
    expect(() => loadLlmConfig({ LLM_PROVIDER: "anthropic", NODE_ENV: "production" })).toThrow(LlmConfigError);
    expect(loadLlmConfig({ LLM_PROVIDER: "anthropic" }).models.light).toBe("claude-haiku-4-5");
  });
});

describe("generateStructured", () => {
  it("returns validated data and logs the call without content", async () => {
    const calls: LlmCallRecord[] = [];
    const seen: ProviderRequest[] = [];
    const provider = createMockProvider({
      text_review: (req) => {
        seen.push(req);
        return { next_step: "Ergänze ein Beispiel.", stars: 2 };
      },
    });
    const result = await generateStructured(request(), { provider, config, onCall: (r) => void calls.push(r) });
    expect(result).toMatchObject({ ok: true, data: { stars: 2 }, promptVersion: 2 });
    expect(seen[0]!.system).toContain("Aufgabe: Stellungnahme");
    expect(seen[0]!.system).not.toContain("E-Bonuskriterien");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ status: "ok", promptName: "text_review", tier: "hard", attempt: 1 });
    expect(JSON.stringify(calls)).not.toContain("Handys");
  });

  it("retries with the validation error, then succeeds", async () => {
    let attempt = 0;
    const provider = createMockProvider({
      text_review: (req) => {
        attempt++;
        if (attempt === 1) return { next_step: "x", stars: 7 };
        expect(req.userText).toContain("passte nicht zum Schema");
        return { next_step: "Ergänze ein Beispiel.", stars: 3 };
      },
    });
    const calls: LlmCallRecord[] = [];
    const result = await generateStructured(request(), { provider, config, onCall: (r) => void calls.push(r) });
    expect(result.ok).toBe(true);
    expect(calls.map((c) => c.status)).toEqual(["schema_error", "ok"]);
  });

  it("gives up after three invalid answers", async () => {
    const provider = createMockProvider({ text_review: () => ({ stars: 9 }) });
    const result = await generateStructured(request(), { provider, config });
    expect(result).toMatchObject({ ok: false, reason: "schema_error" });
  });

  it("never sends learner identity", async () => {
    const provider = createMockProvider({ text_review: () => ({ next_step: "Gut so weiter.", stars: 1 }) });
    await expect(generateStructured(request({ author: "Blauer Falke 42" }), { provider, config })).rejects.toThrow(IdentityLeakError);
  });

  it("reports refusals without retrying", async () => {
    let count = 0;
    const provider: LlmProvider = {
      name: "fake",
      async complete() {
        count++;
        return { json: null, stopReason: "refusal", model: "m", inputTokens: 5, outputTokens: 0 };
      },
    };
    const result = await generateStructured(request(), { provider, config });
    expect(result).toMatchObject({ ok: false, reason: "refused" });
    expect(count).toBe(1);
  });

  it("maps timeouts", async () => {
    const provider: LlmProvider = {
      name: "slow",
      complete: (req) =>
        new Promise((_, reject) => req.signal.addEventListener("abort", () => reject(req.signal.reason))),
    };
    const result = await generateStructured(request(), { provider, config: { ...config, timeoutMs: 10 } });
    expect(result).toMatchObject({ ok: false, reason: "timeout" });
  });

  it("estimates cost from configured prices", async () => {
    const provider: LlmProvider = {
      name: "fake",
      async complete() {
        return { json: { next_step: "Ergänze ein Beispiel.", stars: 1 }, stopReason: "end_turn", model: "m", inputTokens: 1_000_000, outputTokens: 100_000 };
      },
    };
    const calls: LlmCallRecord[] = [];
    await generateStructured(request(), { provider, config, onCall: (r) => void calls.push(r) });
    expect(calls[0]!.costUsd).toBeCloseTo(3);
  });
});

describe("Anthropic provider", () => {
  it("sends images, the system prompt and a structured output format", async () => {
    let params: Record<string, unknown> = {};
    const fakeClient = {
      messages: {
        parse: async (p: Record<string, unknown>) => {
          params = p;
          return { stop_reason: "end_turn", parsed_output: { ok: 1 }, model: "claude-sonnet-5-5", usage: { input_tokens: 3, output_tokens: 4 } };
        },
      },
    };
    const provider = createAnthropicProvider(fakeClient as never);
    const response = await provider.complete({
      promptName: "plan_transcribe",
      model: "claude-sonnet-5-5",
      system: "Transkribiere.",
      userText: "{}",
      images: [{ mediaType: "image/jpeg", data: "AAAA" }],
      schema: z.object({ ok: z.number() }),
      maxTokens: 1000,
      signal: AbortSignal.timeout(1000),
    });
    expect(response).toMatchObject({ json: { ok: 1 }, inputTokens: 3, outputTokens: 4 });
    const messages = params.messages as Array<{ content: Array<{ type: string }> }>;
    expect(messages[0]!.content.map((c) => c.type)).toEqual(["image", "text"]);
    expect(params).toHaveProperty("output_config.format");
    expect(params.system).toBe("Transkribiere.");
  });
});
