import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { promptFlags } from "../domain/state.ts";
import { OUTPUT_SCHEMAS } from "../schemas/output.ts";
import { promptFrontmatterSchema } from "../schemas/promptFrontmatter.ts";
import { MODULE_ROOT } from "./fixtures.ts";

const PROMPT_DIR = new URL("prompts/", MODULE_ROOT);

/** Minimal frontmatter reader for flat `key: value` lines; the platform loader uses a YAML parser. */
function parsePrompt(source: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(source);
  if (!match) throw new Error("no frontmatter");
  const frontmatter: Record<string, unknown> = {};
  for (const line of match[1]!.split("\n")) {
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    frontmatter[key!.trim()] = /^\d+$/.test(value) ? Number(value) : value;
  }
  return { frontmatter, body: match[2]! };
}

const files = readdirSync(PROMPT_DIR).filter((f) => f.endsWith(".md"));
const prompts = files.map((file) => ({ file, ...parsePrompt(readFileSync(new URL(file, PROMPT_DIR), "utf8")) }));

describe("prompt files (spec 7.3)", () => {
  it("has P1 to P5", () => {
    expect(files.sort()).toEqual([
      "plan_review.v1.md",
      "plan_transcribe.v1.md",
      "revision_check.v1.md",
      "text_review.v1.md",
      "text_transcribe.v1.md",
    ]);
  });

  it("has valid frontmatter matching the file name", () => {
    for (const p of prompts) {
      const fm = promptFrontmatterSchema.parse(p.frontmatter);
      expect(p.file).toBe(`${fm.name}.v${fm.version}.md`);
      expect(fm.version).toBe(1);
    }
  });

  it("points every prompt to an existing output schema", () => {
    for (const p of prompts) {
      const name = promptFrontmatterSchema.parse(p.frontmatter).output_schema;
      expect(OUTPUT_SCHEMAS[name]).toBeDefined();
    }
  });

  it("routes to the tiers of spec 7.5", () => {
    const tiers = Object.fromEntries(prompts.map((p) => [p.frontmatter.name, p.frontmatter.model_tier]));
    expect(tiers).toEqual({
      plan_transcribe: "vision",
      plan_review: "light",
      text_transcribe: "vision",
      text_review: "hard",
      revision_check: "light",
    });
  });

  it("uses only {{variable}} and non-nested {{#if flag}}...{{/if}}", () => {
    for (const p of prompts) {
      let open = false;
      for (const [tag] of p.body.matchAll(/\{\{[^}]*\}\}/g)) {
        if (/^\{\{#if [a-z_]+\}\}$/.test(tag)) {
          expect(open, `${p.file}: nested if`).toBe(false);
          open = true;
        } else if (tag === "{{/if}}") {
          expect(open, `${p.file}: stray /if`).toBe(true);
          open = false;
        } else {
          expect(tag, p.file).toMatch(/^\{\{[a-z_]+\}\}$/);
        }
      }
      expect(open, `${p.file}: unclosed if`).toBe(false);
      expect(p.body.replace(/\{\{[^}]*\}\}/g, "")).not.toMatch(/\{\{|\}\}/);
    }
  });

  it("uses only flags that the domain computes", () => {
    const known = Object.keys(promptFlags({ stufe: 4, niveauEEnabled: false }));
    for (const p of prompts) {
      for (const [, flag] of p.body.matchAll(/\{\{#if ([a-z_]+)\}\}/g)) expect(known, p.file).toContain(flag);
    }
    expect(promptFlags({ stufe: 2, niveauEEnabled: false })).toEqual({
      paragraph_template: true,
      full_text: false,
      niveau_e_enabled: false,
    });
    expect(promptFlags({ stufe: "boss", niveauEEnabled: true })).toEqual({
      paragraph_template: false,
      full_text: true,
      niveau_e_enabled: true,
    });
  });

  it("asks for JSON only and never receives identity data", () => {
    for (const p of prompts) {
      expect(p.body.trimEnd().endsWith("Antworte ausschließlich mit JSON nach dem Schema.")).toBe(true);
      expect(p.body).not.toMatch(/\{\{\s*(name|nickname|spitzname|pseudonym|code|access_code|student\w*)\s*\}\}/i);
    }
  });

  it("forbids writing for the student in the review prompts", () => {
    const body = (name: string) => prompts.find((p) => p.frontmatter.name === name)!.body;
    expect(body("plan_review")).toContain("Du schreibst keine Argumente, Beispiele, Thesen oder Sätze für den Schüler");
    expect(body("text_review")).toContain("Du schreibst den Text oder Teile davon nicht neu");
    expect(body("text_review")).toContain("inappropriate");
  });
});
