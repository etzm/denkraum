import { defineModule } from "@denkraum/core";

export const manifest = defineModule({
  id: "mathematik-trigonometrie",
  title: "Trigonometrie-Einstieg",
  schulart: "gesamtschule",
  klasse: 10,
  fach: "Mathematik",
  niveaus: ["G", "M", "E"],
  // Worksheets are shown on the iPad and solved on blank paper (DECISIONS.md, D-012).
  devices: ["ipad", "paper"],
  offline: true,
  llmTiers: ["vision", "light"],
  retentionOverrides: [],
  status: "entwicklung",
});
