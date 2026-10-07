const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

/** Names of all `{{name}}` placeholders in a template. */
export function placeholders(template: string): string[] {
  return [...template.matchAll(PLACEHOLDER)].map((m) => m[1] ?? "");
}

/** Replaces `{{name}}` placeholders. Throws on a missing variable, so no template is shown half-filled. */
export function fillTemplate(template: string, vars: Readonly<Record<string, string>>): string {
  return template.replace(PLACEHOLDER, (_match, name: string) => {
    const value = vars[name];
    if (value === undefined) throw new Error(`missing template variable "${name}"`);
    return value;
  });
}
