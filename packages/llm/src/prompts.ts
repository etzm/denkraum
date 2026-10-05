import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { LLM_TIERS } from "@denkraum/core";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

/**
 * Prompts live in versioned files `prompts/<name>.v<N>.md` with YAML frontmatter.
 * A change is always a new version, never a silent edit; the version used is stored
 * with every result (DECISIONS.md, D-005).
 */

export const promptFrontmatterSchema = z.object({
  name: z.string().regex(/^[a-z0-9_]+$/),
  version: z.number().int().positive(),
  model_tier: z.enum(LLM_TIERS),
  output_schema: z.string().min(1),
});

export type PromptFrontmatter = z.infer<typeof promptFrontmatterSchema>;

export interface LoadedPrompt extends PromptFrontmatter {
  body: string;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parsePromptFile(source: string, fileName?: string): LoadedPrompt {
  const match = FRONTMATTER.exec(source);
  if (!match) throw new Error(`Prompt ${fileName ?? ""} hat keine Frontmatter.`);
  const meta = promptFrontmatterSchema.parse(parseYaml(match[1]!));
  if (fileName) {
    const expected = `${meta.name}.v${meta.version}.md`;
    if (!fileName.endsWith(expected)) throw new Error(`Dateiname ${fileName} passt nicht zu ${expected}.`);
  }
  return { ...meta, body: match[2]!.trim() };
}

/** Loads a prompt by name: a given version, or the highest one in the directory. */
export function loadPrompt(dir: string, name: string, version?: number): LoadedPrompt {
  const versions = readdirSync(dir)
    .map((f) => new RegExp(`^${name}\\.v(\\d+)\\.md$`).exec(f))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]));
  if (versions.length === 0) throw new Error(`Kein Prompt "${name}" in ${dir}.`);
  const chosen = version ?? Math.max(...versions);
  if (!versions.includes(chosen)) throw new Error(`Prompt "${name}" v${chosen} fehlt in ${dir}.`);
  const fileName = `${name}.v${chosen}.md`;
  return parsePromptFile(readFileSync(join(dir, fileName), "utf8"), fileName);
}

export type TemplateVariables = Record<string, string | number | boolean>;

/**
 * Minimal template syntax: `{{name}}` and `{{#if flag}}...{{/if}}` (no nesting, no else).
 * Unknown variables are an error, so a typo never reaches the model silently.
 */
export function renderTemplate(template: string, variables: TemplateVariables): string {
  const withConditionals = template.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, flag: string, inner: string) => {
    if (!(flag in variables)) throw new Error(`Template-Variable "${flag}" fehlt.`);
    return variables[flag] ? inner : "";
  });
  return withConditionals.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (!(key in variables)) throw new Error(`Template-Variable "${key}" fehlt.`);
    return String(variables[key]);
  });
}
