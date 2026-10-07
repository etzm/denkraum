import { defineModuleDefinition } from "@denkraum/sdk";
import { manifest } from "./module.ts";

/** Platform entry point of the module (pages, actions, prompts, upload kinds). A1 builds lesson 4 here. */
export const definition = defineModuleDefinition({
  manifest,
  uploadKinds: { worksheet: { maxPages: 6 } },
  async render(ctx, path) {
    if (path.length > 0) return null;
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">{manifest.title}</h1>
        <p className="text-muted">Lektion 4 wird gerade gebaut.</p>
        <p className="text-sm text-muted">Niveau: {ctx.learner.niveau ?? "noch nicht gewählt"}</p>
      </div>
    );
  },
});
