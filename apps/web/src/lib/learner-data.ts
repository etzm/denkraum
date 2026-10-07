import { deleteLearner, exportLearner, type BlobStore, type Db } from "@denkraum/db";
import { exportLearner as exportSchreibwerkstatt } from "@denkraum/mod-deutsch-schreibwerkstatt/export";
import { exportLearner as exportTrigonometrie } from "@denkraum/mod-mathematik-trigonometrie/export";

/** Module export hooks, importable without React (admin scripts run with plain node). */
const MODULE_EXPORTS: Record<string, (db: Db, learnerId: string) => Promise<Record<string, unknown[]>>> = {
  "deutsch-schreibwerkstatt": exportSchreibwerkstatt,
  "mathematik-trigonometrie": exportTrigonometrie,
};

/** Right of access and portability (Art. 15 and 20 GDPR): platform tables plus every module's tables. */
export async function exportLearnerComplete(db: Db, learnerId: string) {
  const platform = await exportLearner(db, learnerId);
  if (!platform) return null;
  const modules: Record<string, Record<string, unknown[]>> = {};
  for (const [id, hook] of Object.entries(MODULE_EXPORTS)) modules[id] = await hook(db, learnerId);
  return { exportedAt: new Date().toISOString(), platform, modules };
}

/** Right to erasure (Art. 17 GDPR): module rows go with the learner through the cascade, photos are deleted. */
export function deleteLearnerComplete(db: Db, blobs: BlobStore, learnerId: string) {
  return deleteLearner(db, blobs, learnerId);
}
