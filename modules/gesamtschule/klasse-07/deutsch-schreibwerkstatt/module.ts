import { defineModule } from "@denkraum/core";

export const manifest = defineModule({
  id: "deutsch-schreibwerkstatt",
  title: "Schreibwerkstatt",
  schulart: "gesamtschule",
  klasse: 7,
  fach: "Deutsch",
  niveaus: ["M", "E"],
  // No school iPads in grade 7: paper first, upload at home (DECISIONS.md, D-011).
  devices: ["paper", "smartphone", "pc"],
  offline: false,
  llmTiers: ["vision", "hard", "light"],
  retentionOverrides: [],
  status: "entwicklung",
});
