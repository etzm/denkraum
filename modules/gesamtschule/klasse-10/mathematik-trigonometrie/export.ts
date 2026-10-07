import { eq, type Db } from "@denkraum/sdk/db";
import { trigChecks, trigResults, trigWorksheets } from "./db.ts";

/** Everything this module stores about one learner (Art. 15 and 20 GDPR). Deletion runs via the learner cascade. */
export async function exportLearner(db: Db, learnerId: string): Promise<Record<string, unknown[]>> {
  return {
    trig_worksheets: await db.select().from(trigWorksheets).where(eq(trigWorksheets.learnerId, learnerId)),
    trig_checks: await db.select().from(trigChecks).where(eq(trigChecks.learnerId, learnerId)),
    trig_results: await db.select().from(trigResults).where(eq(trigResults.learnerId, learnerId)),
  };
}
