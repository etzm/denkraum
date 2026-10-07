// Loads the module content once per process and applies the adult's approvals per group (D-022).

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "@denkraum/db";
import { swContentApprovals } from "../db.ts";
import type { Checklist, ExerciseStation, FilterConfig, HelpCard, Mission, Rubric } from "../schemas/content.ts";
import {
  checklistFileSchema,
  filterConfigSchema,
  helpCardFileSchema,
  missionFileSchema,
  rubricSchema,
  stationFileSchema,
} from "../schemas/content.ts";
import type { Exercise } from "../schemas/exercise.ts";
import { exerciseFileSchema } from "../schemas/exercise.ts";
import type { GardenConfig } from "../schemas/garden.ts";
import { gardenConfigSchema } from "../schemas/garden.ts";
import type { Queryable } from "./types.ts";

// Same pattern as the migrations folder in packages/db: a path next to the source file.
const CONTENT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "content");

export type Content = {
  missions: Mission[];
  helpCards: HelpCard[];
  checklists: Checklist[];
  stations: ExerciseStation[];
  exercises: Exercise[];
  rubric: Rubric;
  filter: FilterConfig;
  garden: GardenConfig;
};

function read(file: string): unknown {
  return JSON.parse(readFileSync(join(CONTENT_DIR, file), "utf8"));
}

let cached: Content | null = null;

/** Content as stored in the repository, validated. Approval flags as in the JSON files. */
export function loadContent(): Content {
  cached ??= {
    missions: missionFileSchema.parse(read("missions.json")),
    helpCards: helpCardFileSchema.parse(read("help_cards.json")),
    checklists: checklistFileSchema.parse(read("checklists.json")),
    stations: stationFileSchema.parse(read("stations.json")),
    exercises: readdirSync(join(CONTENT_DIR, "exercises"))
      .filter((f) => f.endsWith(".json"))
      .sort()
      .flatMap((f) => exerciseFileSchema.parse(read(join("exercises", f)))),
    rubric: rubricSchema.parse(read("rubric.json")),
    filter: filterConfigSchema.parse(read("filter.json")),
    garden: gardenConfigSchema.parse(read("garden.json")),
  };
  return cached;
}

/** Every id an adult can approve: missions, help cards, exercises, checklists. */
export function approvableIds(content: Content = loadContent()): string[] {
  return [
    ...content.missions.map((m) => m.id),
    ...content.helpCards.map((h) => h.id),
    ...content.exercises.map((e) => e.id),
    ...content.checklists.map((c) => c.id),
  ];
}

export async function approvedIdsFor(db: Queryable, groupId: string): Promise<Set<string>> {
  const rows = await db
    .select({ contentId: swContentApprovals.contentId })
    .from(swContentApprovals)
    .where(eq(swContentApprovals.groupId, groupId));
  return new Set(rows.map((r) => r.contentId));
}

/** Content with `approved` set where the JSON or the group's adult approved it. */
export function withApprovals(content: Content, approved: ReadonlySet<string>): Content {
  const mark = <T extends { id: string; approved: boolean }>(items: T[]) =>
    items.map((i) => (i.approved || approved.has(i.id) ? { ...i, approved: true } : i));
  return {
    ...content,
    missions: mark(content.missions),
    helpCards: mark(content.helpCards),
    exercises: mark(content.exercises),
    checklists: mark(content.checklists),
  };
}

export async function contentForGroup(db: Queryable, groupId: string): Promise<Content> {
  return withApprovals(loadContent(), await approvedIdsFor(db, groupId));
}

export function missionById(content: Content, missionId: string): Mission | undefined {
  return content.missions.find((m) => m.id === missionId);
}
