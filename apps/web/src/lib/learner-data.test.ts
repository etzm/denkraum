import { describe, expect, it } from "vitest";
import { connectDb, createMemoryBlobStore, eq, schema } from "@denkraum/db";
import { swMissionRuns } from "@denkraum/mod-deutsch-schreibwerkstatt/db";
import { trigChecks, trigWorksheets } from "@denkraum/mod-mathematik-trigonometrie/db";
import { deleteLearnerComplete, exportLearnerComplete } from "./learner-data.ts";
import { DEFINITIONS } from "./modules.ts";

async function setup() {
  const db = await connectDb("pglite:memory");
  const [group] = await db
    .insert(schema.groups)
    .values({ kind: "class", label: "Test", schulart: "gesamtschule", klasse: 10, joinCode: "AAAA-BBBB", endsAt: new Date("2027-07-31") })
    .returning();
  const [learner] = await db
    .insert(schema.learners)
    .values({ groupId: group!.id, pseudonym: "Blauer Falke 42", personalCode: "CCCC-DDDD" })
    .returning();
  const learnerId = learner!.id;
  await db.insert(trigWorksheets).values({ learnerId, lesson: 4, niveau: "M", seed: "1", sheetCode: "FDRJ", taskIds: ["L4-A2"], params: {}, attempts: {} });
  await db.insert(trigChecks).values({ learnerId, taskId: "L4-A3", niveau: "M", attemptNo: 1, correct: true, answers: { "2": "7,66" } });
  await db.insert(swMissionRuns).values({ learnerId, missionId: "m-04-01", state: "briefing", data: {} as never });
  return { db, learnerId };
}

describe("learner data requests", () => {
  it("exports platform and module data for one learner", async () => {
    const { db, learnerId } = await setup();
    const data = await exportLearnerComplete(db, learnerId);
    expect(data?.platform.learner.pseudonym).toBe("Blauer Falke 42");
    expect(data?.modules["mathematik-trigonometrie"]?.trig_worksheets).toHaveLength(1);
    expect(data?.modules["mathematik-trigonometrie"]?.trig_checks).toHaveLength(1);
    expect(data?.modules["deutsch-schreibwerkstatt"]?.sw_mission_runs).toHaveLength(1);
    expect(await exportLearnerComplete(db, "unbekannt")).toBeNull();
  });

  it("deletes module rows together with the learner", async () => {
    const { db, learnerId } = await setup();
    expect(await deleteLearnerComplete(db, createMemoryBlobStore(), learnerId)).toBe(true);
    expect(await db.select().from(trigWorksheets)).toHaveLength(0);
    expect(await db.select().from(trigChecks)).toHaveLength(0);
    expect(await db.select().from(swMissionRuns)).toHaveLength(0);
    expect(await db.select().from(schema.learners).where(eq(schema.learners.id, learnerId))).toHaveLength(0);
  });

  it("every module with tables registers its export hook", () => {
    for (const d of DEFINITIONS) expect(d.exportLearner, d.manifest.id).toBeTypeOf("function");
  });
});
