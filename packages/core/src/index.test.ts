import { describe, expect, it } from "vitest";
import { defineModule, moduleClassPath } from "./index.ts";

const base = {
  id: "beispiel-modul",
  title: "Beispiel",
  schulart: "gesamtschule",
  klasse: 7,
  fach: "Deutsch",
  niveaus: ["M"],
  devices: ["paper"],
  offline: false,
  llmTiers: [],
  status: "planung",
} as const;

describe("defineModule", () => {
  it("accepts a valid manifest and defaults retention overrides", () => {
    const m = defineModule({ ...base, niveaus: ["M"], devices: ["paper"], llmTiers: [] });
    expect(m.retentionOverrides).toEqual([]);
    expect(moduleClassPath(m)).toBe("gesamtschule/klasse-07");
  });

  it("rejects a retention override without a real reason", () => {
    expect(() =>
      defineModule({
        ...base,
        niveaus: ["M"],
        devices: ["paper"],
        llmTiers: [],
        retentionOverrides: [{ category: "photos", days: 180, reason: "weil" }],
      }),
    ).toThrow();
  });

  it("rejects ids that are not kebab-case", () => {
    expect(() => defineModule({ ...base, niveaus: ["M"], devices: ["paper"], llmTiers: [], id: "Mathe_10" })).toThrow();
  });
});
