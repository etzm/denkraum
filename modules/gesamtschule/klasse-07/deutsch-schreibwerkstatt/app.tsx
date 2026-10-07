import { defineModuleDefinition } from "@denkraum/sdk";
import { isMissionShown } from "./domain/rules.ts";
import { ACTIONS } from "./mission/actions.ts";
import { B1_MISSION_IDS, checklistItems, findHelpCard, findMission, showUnapprovedContent } from "./mission/content.ts";
import { MOCK_FIXTURES } from "./mission/mocks.ts";
import { findRun, latestRun } from "./mission/store.ts";
import { manifest } from "./module.ts";
import { PROMPTS } from "./prompts/index.ts";
import { card } from "./ui/parts.tsx";
import { RunPage } from "./ui/RunPage.tsx";
import { StartPage, type MissionEntry } from "./ui/StartPage.tsx";

/**
 * Platform entry point of the module. Phase B1: mission m-04-01 with typed plan and text
 * (spec 11, phase 1). Pages: start page and one page per mission run (/lauf/<id>).
 */
export const definition = defineModuleDefinition({
  manifest,
  prompts: PROMPTS,
  uploadKinds: { plan: { maxPages: 2 }, text: { maxPages: 4 }, revision: { maxPages: 2 } },
  mockFixtures: MOCK_FIXTURES,
  actions: ACTIONS,
  async render(ctx, path) {
    const showUnapproved = showUnapprovedContent();

    if (path.length === 0) {
      const entries: MissionEntry[] = [];
      for (const id of B1_MISSION_IDS) {
        const mission = findMission(id);
        if (!mission) continue;
        const latest = await latestRun(ctx.db, ctx.learner.id, id);
        entries.push({ mission, shown: isMissionShown(mission, showUnapproved), latest: latest ? { id: latest.id, state: latest.data.state } : null });
      }
      return <StartPage title={manifest.title} entries={entries} basePath={ctx.basePath} start={ctx.action("starten")} />;
    }

    if (path[0] === "lauf" && path.length === 2) {
      const row = await findRun(ctx.db, ctx.learner.id, path[1]!);
      const mission = row ? findMission(row.missionId) : undefined;
      if (!row || !mission) return null;
      if (!isMissionShown(mission, showUnapproved)) {
        return <p className={card}>Diese Mission wartet auf Freigabe.</p>;
      }
      return (
        <RunPage
          runId={row.id}
          run={row.data}
          mission={mission}
          checklist={checklistItems(mission, row.data.niveauEEnabled)}
          stars={row.stars}
          xp={row.xp}
          helpCard={findHelpCard}
          action={(name) => ctx.action(name)}
          basePath={ctx.basePath}
        />
      );
    }
    return null;
  },
});
