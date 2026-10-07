// View models for the pages: everything a screen needs, computed on the server from the
// event log, the content and the progress. The pages only render.

import type { HelpCard, Mission } from "../schemas/content.ts";
import type { BadgeId, StarSummary, StartBlocker } from "../domain/rules.ts";
import { checkMissionStart, currentStufe, helpCardsForMission, isHelpCardAvailable, isStageVisible, stagePath } from "../domain/rules.ts";
import type { MissionRun, SystemAction } from "../domain/state.ts";
import { pendingSystemAction } from "../domain/state.ts";
import { runStars } from "../domain/summary.ts";
import type { Stufe } from "../schemas/common.ts";
import { contentForGroup, missionById } from "./content.ts";
import { getProgress, progressContext, rewardsForRun, unlockedHelpCardIds } from "./progress.ts";
import { loadRun, loadRuns } from "./runs.ts";
import type { Learner, Queryable } from "./types.ts";

export type MissionCard = {
  mission: Mission;
  status: "completed" | "in_progress" | "startable" | "locked";
  blockers: StartBlocker[];
  /** The open run, else the latest completed one. */
  runId: string | null;
  completedRuns: number;
};

export type StageGroup = { stufe: Stufe; current: boolean; missions: MissionCard[] };

export type Overview = {
  stages: StageGroup[];
  progress: { xp: number; keys: number; streakDays: number; badges: BadgeId[] };
};

export async function missionOverview(db: Queryable, learner: Learner): Promise<Overview> {
  const content = await contentForGroup(db, learner.groupId);
  const ctx = await progressContext(db, learner);
  const runs = await loadRuns(db, learner.id);
  const current = currentStufe(content.missions, ctx);
  const progress = await getProgress(db, learner.id);

  const stages = stagePath(learner.niveauEEnabled)
    .filter((s) => isStageVisible(s, learner.niveauEEnabled))
    .map((stufe): StageGroup => ({
      stufe,
      current: stufe === current,
      missions: content.missions
        .filter((m) => m.stufe === stufe)
        .sort((a, b) => a.order - b.order)
        .map((mission): MissionCard => {
          const own = runs.filter((r) => r.row.missionId === mission.id);
          const open = own.find((r) => r.run.state !== "completed");
          const done = own.filter((r) => r.run.state === "completed");
          const check = checkMissionStart(mission, content.missions, ctx);
          return {
            mission,
            status: open ? "in_progress" : done.length > 0 ? "completed" : check.startable ? "startable" : "locked",
            blockers: check.blockers,
            runId: open?.row.id ?? done.at(-1)?.row.id ?? null,
            completedRuns: done.length,
          };
        }),
    }));
  return {
    stages,
    progress: {
      xp: progress.xp,
      keys: progress.keys,
      streakDays: progress.streakDays,
      badges: progress.badges as BadgeId[],
    },
  };
}

export type MissionPage = {
  runId: string;
  run: MissionRun;
  mission: Mission;
  pending: SystemAction | null;
  checklist: { id: string; text: string }[];
  /** Help cards the child can open in this mission (none in the boss). */
  helpCards: HelpCard[];
  /** The card named by the revision task, when the child has it (SW-14); never in the boss. */
  revisionCard: HelpCard | null;
  stars: StarSummary | null;
  rewards: { xp: number; keys: number };
  progress: { xp: number; keys: number; badges: BadgeId[] };
};

export async function missionPage(db: Queryable, learner: Learner, runId: string): Promise<MissionPage | null> {
  const loaded = await loadRun(db, learner.id, runId);
  if (!loaded) return null;
  const content = await contentForGroup(db, learner.groupId);
  const mission = missionById(content, loaded.run.missionId);
  if (!mission) return null;
  const ctx = await progressContext(db, learner);
  const checklist = content.checklists.find((c) => c.id === mission.checklistId);
  const progress = await getProgress(db, learner.id);
  const cardCtx = {
    currentStufe: currentStufe(content.missions, ctx),
    unlockedIds: await unlockedHelpCardIds(db, learner.id),
    niveauEEnabled: learner.niveauEEnabled,
  };
  const cards = content.helpCards.filter((h) => h.approved);
  const taskCard = cards.find((h) => h.id === loaded.run.feedback.review?.revision_task.help_card_id);
  return {
    runId,
    run: loaded.run,
    mission,
    pending: pendingSystemAction(loaded.run),
    checklist: (checklist?.items ?? []).filter((i) => !i.niveauE || loaded.run.niveauEEnabled).map((i) => ({ id: i.id, text: i.text })),
    helpCards: helpCardsForMission(mission, cards, cardCtx),
    revisionCard: !mission.bossMode && taskCard && isHelpCardAvailable(taskCard, cardCtx) ? taskCard : null,
    stars: runStars(loaded.run),
    rewards: await rewardsForRun(db, learner.id, runId),
    progress: { xp: progress.xp, keys: progress.keys, badges: progress.badges as BadgeId[] },
  };
}
