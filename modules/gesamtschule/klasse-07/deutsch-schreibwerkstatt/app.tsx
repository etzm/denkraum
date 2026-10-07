import { defineModuleDefinition } from "@denkraum/sdk";
import { manifest } from "./module.ts";
import { PROMPTS } from "./prompts/index.ts";

/** Platform entry point of the module (pages, actions, prompts, upload kinds). B1 builds mission m-04-01 here. */
export const definition = defineModuleDefinition({
  manifest,
  prompts: PROMPTS,
  uploadKinds: { plan: { maxPages: 2 }, text: { maxPages: 4 }, revision: { maxPages: 2 } },
  async render(_ctx, path) {
    if (path.length > 0) return null;
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">{manifest.title}</h1>
        <p className="text-muted">Die erste Mission wird gerade gebaut.</p>
      </div>
    );
  },
});
