"use server";

import {
  eventFromForm,
  isStepKind,
  loadRun,
  runPendingActions,
  startMission,
  submitStudentEvent,
} from "@denkraum/mod-deutsch-schreibwerkstatt/server";
import { notFound, redirect } from "next/navigation";
import { requireSchreibwerkstattLearner, schreibwerkstattDeps, SW_BASE } from "@/lib/schreibwerkstatt.ts";

const runUrl = (runId: string, error?: string) => `${SW_BASE}/mission/${runId}${error ? `?fehler=${error}` : ""}`;

const FORM_ERRORS = { invalid: "ungueltig", empty: "leer", too_long: "zu_lang" } as const;

export async function startMissionAction(missionId: string): Promise<void> {
  const learner = await requireSchreibwerkstattLearner();
  const result = await startMission(await schreibwerkstattDeps(), learner, missionId);
  if (!result.ok) redirect(`${SW_BASE}?fehler=gesperrt`);
  redirect(runUrl(result.runId));
}

/** One student step: form to event, the state machine decides, then the system steps run. */
export async function stepAction(runId: string, kind: string, formData: FormData): Promise<void> {
  const learner = await requireSchreibwerkstattLearner();
  if (!isStepKind(kind)) notFound();
  const deps = await schreibwerkstattDeps();
  const loaded = await loadRun(deps.db, learner.id, runId);
  if (!loaded) notFound();
  const parsed = eventFromForm(kind, formData, loaded.run);
  if (!parsed.ok) redirect(runUrl(runId, FORM_ERRORS[parsed.error]));
  const result = await submitStudentEvent(deps, learner, runId, parsed.event);
  if (!result.ok) redirect(runUrl(runId, kind === "self_check" ? "markierung" : "ungueltig"));
  redirect(runUrl(runId, result.pending === "ai_unavailable" ? "ki" : undefined));
}

/** Resumes a pending system step, for example after a reload or a failed model call. */
export async function pendingStepAction(runId: string): Promise<void> {
  const learner = await requireSchreibwerkstattLearner();
  const outcome = await runPendingActions(await schreibwerkstattDeps(), learner, runId);
  redirect(runUrl(runId, outcome === "ai_unavailable" ? "ki" : undefined));
}
