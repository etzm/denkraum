/**
 * Prompts must never contain who a learner is: no pseudonym, no access code, no group id.
 * Modules build prompts from identity-free input types; this guard is the second line of
 * defence and runs on every rendered prompt before it leaves the server.
 */

export class IdentityLeakError extends Error {
  readonly kinds: string[];

  constructor(kinds: string[]) {
    super(`Prompt enthält Identitätsmerkmale: ${kinds.join(", ")}`);
    this.name = "IdentityLeakError";
    this.kinds = kinds;
  }
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export interface KnownIdentifiers {
  pseudonym?: string;
  accessCodes?: string[];
  ids?: string[];
}

export function findIdentityLeaks(text: string, known: KnownIdentifiers): string[] {
  const haystack = text.toLowerCase();
  const kinds: string[] = [];
  if (known.pseudonym && haystack.includes(known.pseudonym.toLowerCase())) kinds.push("pseudonym");
  for (const code of known.accessCodes ?? []) {
    const bare = code.replace("-", "").toLowerCase();
    if (haystack.includes(code.toLowerCase()) || haystack.includes(bare)) kinds.push("access_code");
  }
  for (const id of known.ids ?? []) {
    if (id.length >= 8 && haystack.includes(id.toLowerCase())) kinds.push("id");
  }
  if (EMAIL.test(text)) kinds.push("email");
  return [...new Set(kinds)];
}

export function assertIdentityFree(text: string, known: KnownIdentifiers): void {
  const kinds = findIdentityLeaks(text, known);
  if (kinds.length > 0) throw new IdentityLeakError(kinds);
}
