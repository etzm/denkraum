import type { LlmTier } from "@denkraum/core";

export type ProviderName = "mock" | "anthropic" | "bedrock";

export interface LlmConfig {
  provider: ProviderName;
  models: Record<LlmTier, string>;
  awsRegion: string | undefined;
  timeoutMs: number;
  maxTokens: number;
  /** USD per million tokens [input, output], optional, for the cost log. */
  prices: Partial<Record<LlmTier, [number, number]>>;
}

const DEFAULT_MODELS: Record<Exclude<ProviderName, "mock">, Record<LlmTier, string>> = {
  anthropic: { vision: "claude-sonnet-5-5", hard: "claude-sonnet-5-5", light: "claude-haiku-4-5" },
  // Verify per model that it is offered in the chosen EU region before going live.
  bedrock: { vision: "anthropic.claude-sonnet-5-5", hard: "anthropic.claude-sonnet-5-5", light: "anthropic.claude-haiku-4-5" },
};

export class LlmConfigError extends Error {
  override name = "LlmConfigError";
}

function parsePrice(value: string | undefined): [number, number] | undefined {
  if (!value) return undefined;
  const [input, output] = value.split(",").map(Number);
  if (input === undefined || output === undefined || Number.isNaN(input) || Number.isNaN(output)) {
    throw new LlmConfigError(`Preisangabe "${value}" muss "input,output" in USD je Million Tokens sein.`);
  }
  return [input, output];
}

/**
 * Reads the model configuration from the environment.
 * Privacy rules enforced here (DECISIONS.md, D-013):
 * - bedrock only in an EU region,
 * - the direct Anthropic API only outside production (development with synthetic data),
 *   unless explicitly overridden.
 */
export function loadLlmConfig(env: Record<string, string | undefined> = process.env): LlmConfig {
  const provider = (env.LLM_PROVIDER ?? "mock") as ProviderName;
  if (!["mock", "anthropic", "bedrock"].includes(provider)) {
    throw new LlmConfigError(`Unbekannter LLM_PROVIDER "${provider}".`);
  }
  const allowNonEu = env.LLM_ALLOW_NON_EU === "true";
  const awsRegion = env.AWS_REGION ?? env.AWS_DEFAULT_REGION;
  if (provider === "bedrock" && !allowNonEu && !awsRegion?.startsWith("eu-")) {
    throw new LlmConfigError(`Bedrock nur in einer EU-Region (AWS_REGION ist "${awsRegion ?? "leer"}").`);
  }
  if (provider === "anthropic" && env.NODE_ENV === "production" && !allowNonEu) {
    throw new LlmConfigError("Die direkte Anthropic-API ist nur für die Entwicklung mit synthetischen Daten vorgesehen.");
  }
  const defaults = provider === "mock" ? { vision: "mock", hard: "mock", light: "mock" } : DEFAULT_MODELS[provider];
  const prices: LlmConfig["prices"] = {};
  for (const tier of ["vision", "hard", "light"] as const) {
    const price = parsePrice(env[`LLM_PRICE_${tier.toUpperCase()}`]);
    if (price) prices[tier] = price;
  }
  return {
    provider,
    models: {
      vision: env.MODEL_VISION ?? defaults.vision,
      hard: env.MODEL_HARD ?? defaults.hard,
      light: env.MODEL_LIGHT ?? defaults.light,
    },
    awsRegion,
    timeoutMs: Number(env.LLM_TIMEOUT_MS ?? 60_000),
    maxTokens: Number(env.LLM_MAX_TOKENS ?? 16_000),
    prices,
  };
}
