import { eq, type Db } from "@denkraum/sdk/db";
import { swMissionRuns } from "./db.ts";

/** Everything this module stores about one learner (Art. 15 and 20 GDPR). Texts and feedback are in the platform tables. */
export async function exportLearner(db: Db, learnerId: string): Promise<Record<string, unknown[]>> {
  return {
    sw_mission_runs: await db.select().from(swMissionRuns).where(eq(swMissionRuns.learnerId, learnerId)),
  };
}
