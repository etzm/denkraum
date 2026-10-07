// Helpers for the development seed and the end-to-end tests. They use the real services
// with synthetic text, so a demo learner has the same data as a real one.

import { swContentApprovals, swExerciseAttempts } from "../db.ts";
import { KEYS_PER_STATION, XP } from "../domain/rules.ts";
import type { MissionEvent } from "../domain/state.ts";
import { stageMedia } from "../domain/state.ts";
import type { PlanTranscript } from "../schemas/planTranscript.ts";
import { approvableIds, loadContent, missionById } from "./content.ts";
import { book, markActivity, registerStreakActivity } from "./progress.ts";
import { startMission, submitStudentEvent } from "./runs.ts";
import type { Learner, Queryable, ServiceDeps } from "./types.ts";

/** Development and tests only: an adult would approve content one by one (D-022). */
export async function approveAllContent(db: Queryable, groupId: string): Promise<void> {
  await db
    .insert(swContentApprovals)
    .values(approvableIds().map((contentId) => ({ groupId, contentId })))
    .onConflictDoNothing();
}

/** A passed station round without answers, until the stations exist (B4). Books the key once per station. */
export async function recordStationPass(db: Queryable, learnerId: string, stationId: string, at: Date): Promise<void> {
  const [attempt] = await db
    .insert(swExerciseAttempts)
    .values({ learnerId, stationId, exerciseIds: [], answers: [], results: [], passed: true, createdAt: at })
    .returning({ id: swExerciseAttempts.id });
  await book(db, { learnerId, kind: "keys", delta: KEYS_PER_STATION, reason: "station_first_pass", refId: stationId, at });
  await book(db, { learnerId, kind: "xp", delta: XP.stationPassed, reason: "station_passed", refId: attempt!.id, at });
  await markActivity(db, learnerId, at);
  await registerStreakActivity(db, learnerId, at);
}

const DEMO_TEXT = [
  "An unserer Schule wird gerade viel darüber gesprochen. Ich bin der Meinung, dass wir etwas ändern sollten.",
  "Zunächst hätten wir dann mehr Zeit für das Wichtige. Im Moment ist der Tag sehr voll, weil viele Stunden hintereinander liegen. Gestern hatte ich zum Beispiel kaum eine Pause.",
  "Außerdem würden wir uns besser konzentrieren. Wer sich zwischendurch erholt, arbeitet danach wacher. In unserer Klasse sind nach langen Tagen viele müde.",
  "Vor allem aber würde die Stimmung besser. Wenn alle weniger Stress haben, gibt es weniger Streit. Das sieht man an Tagen mit langen Pausen.",
  "Aus diesen Gründen bitte ich Sie, den Vorschlag zu unterstützen.",
];

const DEMO_PLAN: PlanTranscript = {
  thema: "Demo-Thema",
  standpunkt: "Ich bin dafür.",
  argumente: [
    { behauptung: "mehr Zeit", begruendung: "Tag ist voll", beispiel: "gestern kaum Pause" },
    { behauptung: "besser konzentrieren", begruendung: "Erholung macht wach", beispiel: "viele müde" },
    { behauptung: "bessere Stimmung", begruendung: "weniger Stress", beispiel: "Tage mit langen Pausen" },
  ],
  reihenfolge: "1, 2, 3",
  schluss: "Bitte um Unterstützung",
  legibility: 1,
  uncertain: [],
};

const DEMO_PARAGRAPH_PLAN: PlanTranscript = {
  ...DEMO_PLAN,
  thema: "",
  standpunkt: "",
  argumente: [DEMO_PLAN.argumente[0]!, { behauptung: "", begruendung: "", beispiel: "" }, { behauptung: "", begruendung: "", beispiel: "" }],
  reihenfolge: "",
  schluss: "",
};

/** Completes a mission with synthetic typed text, through every state and every AI step. */
export async function completeMissionTyped(deps: ServiceDeps, learner: Learner, missionId: string): Promise<string> {
  const mission = missionById(loadContent(), missionId);
  if (!mission) throw new Error(`unknown mission ${missionId}`);
  const started = await startMission(deps, learner, missionId);
  if (!started.ok) throw new Error(`cannot start ${missionId}: ${started.reason}`);
  const media = stageMedia(mission.stufe);
  const text = mission.stufe === 1 ? [DEMO_TEXT[0]!] : mission.stufe === 2 ? [DEMO_TEXT[1]!] : DEMO_TEXT;
  const events: MissionEvent[] = [{ type: "BRIEFING_ACK" }];
  if (media.plan !== "none") {
    events.push(
      { type: "PLAN_TYPED", plan: media.plan === "paragraph_template" ? DEMO_PARAGRAPH_PLAN : DEMO_PLAN },
      { type: "PLAN_FEEDBACK_DONE" },
      { type: "START_WRITING" },
    );
  }
  events.push(
    { type: "TEXT_TYPED", paragraphs: text },
    { type: "SELF_CHECK_SUBMITTED", selfCheck: { checkedItemIds: [], marks: [] } },
    { type: "START_REVISION" },
    { type: "REVISION_SUBMITTED", text: "Deshalb bitte ich Sie, den Vorschlag zu unterstützen." },
  );
  for (const event of events) {
    const result = await submitStudentEvent(deps, learner, started.runId, event);
    if (!result.ok) throw new Error(`${missionId} ${event.type}: ${result.reason} ${result.detail ?? ""}`);
  }
  return started.runId;
}

