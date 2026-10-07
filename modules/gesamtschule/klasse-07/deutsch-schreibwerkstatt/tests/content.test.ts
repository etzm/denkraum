import { describe, expect, it } from "vitest";
import { scoreExercise } from "../domain/exercises.ts";
import { minWordsFor } from "../domain/rules.ts";
import { stageMedia } from "../domain/state.ts";
import { countWords, paragraphsToText } from "../domain/text.ts";
import {
  checklistFileSchema,
  helpCardFileSchema,
  missionFileSchema,
  stationFileSchema,
} from "../schemas/content.ts";
import type { Exercise } from "../schemas/exercise.ts";
import { EXERCISE_TYPES, exerciseFileSchema } from "../schemas/exercise.ts";
import { readJson } from "./fixtures.ts";

const missions = missionFileSchema.parse(readJson("content/missions.json"));
const helpCards = helpCardFileSchema.parse(readJson("content/help_cards.json"));
const checklists = checklistFileSchema.parse(readJson("content/checklists.json"));
const stations = stationFileSchema.parse(readJson("content/stations.json"));
const exercises = exerciseFileSchema.parse(readJson("content/exercises/seed.json"));

const unique = (ids: string[]) => new Set(ids).size === ids.length;

function correctAnswer(e: Exercise): unknown {
  switch (e.type) {
    case "sort_paragraphs":
    case "rank_arguments":
      return e.payload.correct_order;
    case "fill_connector":
      return e.payload.gaps.map((g) => g.correct);
    default:
      return e.payload.correct;
  }
}

describe("content files validate", () => {
  it("has unique ids", () => {
    expect(unique(missions.map((m) => m.id))).toBe(true);
    expect(unique(helpCards.map((h) => h.id))).toBe(true);
    expect(unique(checklists.map((c) => c.id))).toBe(true);
    expect(unique(stations.map((s) => s.id))).toBe(true);
    expect(unique(exercises.map((e) => e.id))).toBe(true);
    for (const c of checklists) expect(unique(c.items.map((i) => i.id))).toBe(true);
  });

  it("waits for the German teacher: nothing is approved yet", () => {
    for (const item of [...missions, ...helpCards, ...checklists, ...exercises]) expect(item.approved).toBe(false);
  });
});

describe("missions (spec 10.1)", () => {
  it("contains the mission ids of the spec", () => {
    expect(missions.map((m) => m.id)).toEqual([
      "m-01-01",
      "m-01-02",
      "m-02-01",
      "m-02-02",
      "m-03-01",
      "m-03-02",
      "m-04-01",
      "m-04-02",
      "m-04-03",
      "m-05-01",
      "m-05-02",
      "m-06-01",
      "m-06-02",
      "boss-01",
    ]);
  });

  it("orders missions within a stage without gaps", () => {
    for (const stufe of [1, 2, 3, 4, 5, 6, "boss"] as const) {
      const orders = missions.filter((m) => m.stufe === stufe).map((m) => m.order);
      expect(orders).toEqual(orders.map((_, i) => i + 1));
    }
  });

  it("references existing help cards, checklists, stations and missions", () => {
    for (const m of missions) {
      for (const id of m.helpCardIds) expect(helpCards.map((h) => h.id)).toContain(id);
      expect(checklists.map((c) => c.id)).toContain(m.checklistId);
      if (m.requiresExerciseStationId) {
        const station = stations.find((s) => s.id === m.requiresExerciseStationId);
        expect(station?.stufe).toBe(m.stufe);
      }
      if (m.revisesMissionId) expect(missions.map((x) => x.id)).toContain(m.revisesMissionId);
    }
  });

  it("marks stage 6 as Niveau E and the boss without help cards", () => {
    for (const m of missions.filter((x) => x.stufe === 6)) {
      expect(m.niveau).toBe("E");
      expect(m.schreibform).toBe("eroerterung_linear");
    }
    const boss = missions.find((m) => m.bossMode)!;
    expect(boss.helpCardIds).toEqual([]);
    expect(boss.timeboxPlan + boss.timeboxWrite).toBe(45);
  });

  it("tells students not to write their name on paper (spec 7.6)", () => {
    for (const m of missions) {
      const media = stageMedia(m.stufe);
      if (media.plan !== "none" || media.text === "paper") {
        expect(m.prompt).toContain("Schreib deinen Namen nicht auf das Blatt");
      }
    }
  });

  it("gives stage 5 a sample text of 120 to 180 words", () => {
    const sample = missions.find((m) => m.id === "m-05-02")!;
    const n = countWords(paragraphsToText(sample.givenText ?? []));
    expect(n).toBeGreaterThanOrEqual(120);
    expect(n).toBeLessThanOrEqual(180);
    expect(n).toBeGreaterThanOrEqual(minWordsFor(5));
  });
});

describe("help cards (spec 10.2)", () => {
  it("has HK-01 to HK-09 on the stages of the spec", () => {
    expect(Object.fromEntries(helpCards.map((h) => [h.id, h.stufe]))).toEqual({
      "HK-01": 3,
      "HK-02": 1,
      "HK-03": 1,
      "HK-04": 2,
      "HK-05": 3,
      "HK-06": 4,
      "HK-07": 6,
      "HK-08": 5,
      "HK-09": 4,
    });
    expect(helpCards.filter((h) => h.niveau === "E").map((h) => h.id)).toEqual(["HK-07"]);
  });
});

describe("checklists (spec 10.3)", () => {
  it("stage 6 adds the counterargument to stage 4", () => {
    const cl4 = checklists.find((c) => c.id === "cl-04")!;
    const cl6 = checklists.find((c) => c.id === "cl-06")!;
    expect(cl4.items).toHaveLength(7);
    expect(cl6.items.slice(0, 7)).toEqual(cl4.items);
    expect(cl6.items[7]?.text).toBe("Ich habe ein Gegenargument genannt und entkräftet.");
  });
});

describe("stations and exercise seed (spec 5, 10.4)", () => {
  it("uses size 4 and pass threshold 3", () => {
    for (const s of stations) expect([s.size, s.passThreshold]).toEqual([4, 3]);
    expect(stations.filter((s) => s.demo).map((s) => s.stufe)).toEqual([1, 2]);
  });

  it("has at least two example exercises per type", () => {
    for (const type of EXERCISE_TYPES) expect(exercises.filter((e) => e.type === type).length).toBeGreaterThanOrEqual(2);
  });

  it("only seeds exercises that a station can draw", () => {
    for (const e of exercises) {
      expect(stations.some((s) => s.stufe === e.stufe && s.exerciseTypes.includes(e.type))).toBe(true);
    }
  });

  it("scores the stored solution of every seed exercise as correct", () => {
    for (const e of exercises) expect(scoreExercise(e, correctAnswer(e))).toBe(true);
  });
});

describe("German spelling", () => {
  // Spelled-out umlauts in student-facing text; ids, keys and tags may use them.
  const ascii = /\b(fuer|ueber\w*|Schueler\w*|koennen|muessen|moechte|waere|haette|naechste\w*|Begruendung|Gruende|Staerke\w*|Uebung|Ueberarbeit\w*|ausschliesslich|heisst|Verknuepf\w*|staerkste\w*|Entkraeft\w*)\b/i;
  const skipKeys = new Set(["id", "type", "tags", "target", "correct", "checklistId", "requiresExerciseStationId", "revisesMissionId", "schreibform", "helpCardIds"]);

  function strings(value: unknown, key = ""): string[] {
    if (skipKeys.has(key)) return [];
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) return value.flatMap((v) => strings(v));
    if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => strings(v, k));
    return [];
  }

  it("uses real umlauts in all content texts", () => {
    for (const file of ["missions", "help_cards", "checklists", "stations", "exercises/seed", "garden"]) {
      for (const s of strings(readJson(`content/${file}.json`))) expect(s).not.toMatch(ascii);
    }
  });
});
