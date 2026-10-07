// Input filter before plan review (P2) and text review (P4), spec 7.6 and SW-09.
// Deterministic word list, no model: a hit holds the run for an adult; nothing is shown
// to the child except that an adult will look at it. The list is maintained with the
// school (Schutzkonzept); false positives only cost an adult's look, never a penalty.

import type { FilterConfig } from "../schemas/content.ts";

export type FilterResult = { flagged: boolean; categories: string[] };

function termPattern(term: string): RegExp {
  // "*" at the end matches any word ending; spaces match any whitespace.
  const stem = term.endsWith("*");
  const body = (stem ? term.slice(0, -1) : term)
    .normalize("NFC")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}${stem ? "[\\p{L}]*" : ""}(?![\\p{L}\\p{N}])`, "iu");
}

export function screenText(text: string, config: FilterConfig): FilterResult {
  const normalized = text.normalize("NFC");
  const categories = Object.entries(config.categories)
    .filter(([, terms]) => terms.some((t) => termPattern(t).test(normalized)))
    .map(([category]) => category);
  return { flagged: categories.length > 0, categories };
}
