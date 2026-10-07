import { randomInt } from "node:crypto";

type Gender = "m" | "f" | "n";

// Neutral, friendly words only. No first names, so a pseudonym never looks like a real person.
const ADJECTIVES = [
  "blau", "grün", "rot", "gelb", "golden", "silbern", "flink", "mutig", "ruhig", "klug",
  "schlau", "wach", "leise", "sonnig", "hell", "frei", "stark", "sanft", "munter", "fröhlich",
] as const;

const NOUNS: ReadonlyArray<readonly [string, Gender]> = [
  ["Falke", "m"], ["Fuchs", "m"], ["Dachs", "m"], ["Biber", "m"], ["Luchs", "m"],
  ["Igel", "m"], ["Specht", "m"], ["Kranich", "m"], ["Delfin", "m"], ["Otter", "m"],
  ["Hirsch", "m"], ["Adler", "m"], ["Rabe", "m"], ["Eule", "f"], ["Möwe", "f"],
  ["Libelle", "f"], ["Amsel", "f"], ["Lerche", "f"], ["Robbe", "f"], ["Meise", "f"],
  ["Schildkröte", "f"], ["Gämse", "f"], ["Pferd", "n"], ["Reh", "n"], ["Eichhörnchen", "n"],
  ["Murmeltier", "n"], ["Zebra", "n"], ["Lama", "n"], ["Erdmännchen", "n"], ["Faultier", "n"],
];

/** Strong declension, nominative singular without article: "blauer Falke", "blaue Eule", "blaues Pferd". */
export function declineAdjective(adjective: string, gender: Gender): string {
  const stem = adjective.endsWith("e") ? adjective.slice(0, -1) : adjective;
  const ending = { m: "er", f: "e", n: "es" }[gender];
  return stem + ending;
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Generates a pseudonym such as "Blauer Falke 42".
 * Pseudonyms are generated, never chosen, because children often pick their real name.
 * Uniqueness within a group is the caller's job (retry on collision).
 */
export function generatePseudonym(random: (max: number) => number = randomInt): string {
  const adjective = ADJECTIVES[random(ADJECTIVES.length)]!;
  const [noun, gender] = NOUNS[random(NOUNS.length)]!;
  const number = 10 + random(90);
  return `${capitalize(declineAdjective(adjective, gender))} ${noun} ${number}`;
}

export const PSEUDONYM_SPACE = ADJECTIVES.length * NOUNS.length * 90;
