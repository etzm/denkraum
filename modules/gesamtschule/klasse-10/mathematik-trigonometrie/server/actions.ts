import { NIVEAUS, type Niveau } from "@denkraum/core";
import type { ActionResult, ModuleAction, ModuleContext } from "@denkraum/sdk";
import {
  aiFeedbackSchema,
  aiTranscriptionSchema,
  changedShare,
  confirmTask,
  enforceDecisions,
  feedbackInput,
  revealsResult,
  transcribedFor,
  transcribeInput,
  type AiFeedback,
} from "../domain/ai.ts";
import { parseDecimal } from "../domain/format.ts";
import {
  calculatorCheck,
  checkFaded,
  failedAttempts,
  fadedState,
  lessonTasks,
  nextAction,
  planWorksheet,
  solutionAvailable,
  tasksForNextSheet,
  worksheetUnlocked,
} from "../domain/lesson.ts";
import { getTask } from "../domain/tasks.ts";
import { verify } from "../domain/verify.ts";
import {
  addCheck,
  addFeedback,
  addResults,
  addTranscript,
  addWorksheet,
  asPrior,
  checksOf,
  confirmTranscript,
  markSolutionViewed,
  resultsOf,
  resultsOfSheet,
  setNiveau,
  transcriptOf,
  worksheet,
  worksheetsOf,
} from "./store.ts";

/** Lesson of this vertical slice (A1). */
const LESSON = 4;

const field = (form: FormData, name: string): string => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

const home = (ctx: ModuleContext): ActionResult => ({ redirect: ctx.basePath });

function isNiveau(value: string): value is Niveau {
  return (NIVEAUS as readonly string[]).includes(value);
}

/** Random seed per sheet: never derived from the learner (docs/datenschutz/README.md section 1). */
function newSeed(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 16);
}

async function fadedProgress(ctx: ModuleContext) {
  const { faded } = lessonTasks(LESSON);
  const checks = await checksOf(ctx, faded.map((t) => t.id));
  return worksheetUnlocked(faded.map((t) => fadedState(checks.filter((c) => c.taskId === t.id))));
}

async function createSheet(ctx: ModuleContext, niveau: Niveau, withHelp: boolean) {
  const { paper } = lessonTasks(LESSON);
  const prior = asPrior(await resultsOf(ctx, paper.map((t) => t.id)));
  const seed = newSeed();
  const plan = planWorksheet(tasksForNextSheet(paper, prior), seed, prior);
  return addWorksheet(ctx, {
    lesson: LESSON,
    niveau,
    seed,
    sheetCode: plan.sheetCode,
    taskIds: plan.taskIds,
    params: plan.params,
    attempts: plan.attempts,
    withHelp,
  });
}

/** Niveau G, M or E, chosen by the learner and stored on the platform learner (spec A 2.6). */
const niveau: ModuleAction = async (ctx, form) => {
  const value = field(form, "niveau");
  if (isNiveau(value)) await setNiveau(ctx, value);
  return home(ctx);
};

/** Calculator check: sin 30° in DEG, RAD or GRAD mode. Nothing is stored. */
const rechner: ModuleAction = async (ctx, form) => {
  const mode = calculatorCheck(field(form, "wert")) ?? "leer";
  return { redirect: `${ctx.basePath}/lektion/${LESSON}?rechner=${mode}#rechner` };
};

/** One attempt at a faded task (spec A 5.3). */
const luecke: ModuleAction = async (ctx, form) => {
  const level = ctx.learner.niveau;
  const task = lessonTasks(LESSON).faded.find((t) => t.id === field(form, "task"));
  if (!level || !task) return home(ctx);
  const checks = await checksOf(ctx, [task.id]);
  const state = fadedState(checks);
  // A new query string per attempt: a redirect that only changes the #hash would not reload the page.
  const target = { redirect: `${ctx.basePath}/lektion/${LESSON}/uebung?versuch=${task.id}-${checks.length + 1}#${task.id}` };
  if (!state.done) {
    const answers: Record<string, string> = {};
    for (const [key, value] of form.entries()) {
      if (key.startsWith("s") && /^s\d+$/.test(key) && typeof value === "string") answers[key.slice(1)] = value.slice(0, 200);
    }
    const result = checkFaded(task, level, answers, state.wrong);
    await addCheck(ctx, {
      taskId: task.id,
      niveau: level,
      attemptNo: checks.length + 1,
      correct: result.correct,
      misconceptionCodes: result.codes,
      answers,
      hint: result.hint,
    });
  }
  return target;
};

/** Opens the current sheet, or creates one once both faded tasks are done. */
const blattOeffnen: ModuleAction = async (ctx) => {
  const level = ctx.learner.niveau;
  if (!level) return home(ctx);
  const unlock = await fadedProgress(ctx);
  if (!unlock.open) return { redirect: `${ctx.basePath}/lektion/${LESSON}/uebung` };
  for (const sheet of await worksheetsOf(ctx, LESSON)) {
    if (sheet.niveau !== level) continue;
    if ((await resultsOfSheet(ctx, sheet.id)).length === 0) return { redirect: `${ctx.basePath}/blatt/${sheet.id}` };
    break;
  }
  const sheet = await createSheet(ctx, level, unlock.withHelp);
  return { redirect: `${ctx.basePath}/blatt/${sheet.id}` };
};

/** "Nochmal mit neuen Zahlen": a new sheet with the tasks that are not right yet. */
const neu: ModuleAction = async (ctx) => {
  const level = ctx.learner.niveau;
  if (!level) return home(ctx);
  const unlock = await fadedProgress(ctx);
  if (!unlock.open) return { redirect: `${ctx.basePath}/lektion/${LESSON}/uebung` };
  const sheet = await createSheet(ctx, level, unlock.withHelp);
  return { redirect: `${ctx.basePath}/blatt/${sheet.id}` };
};

/** Sheet and upload of a form, both owned by the learner and belonging together. */
async function sheetAndUpload(ctx: ModuleContext, form: FormData) {
  const sheet = await worksheet(ctx, field(form, "blatt"));
  const uploadId = field(form, "upload");
  const upload = sheet && uploadId ? await ctx.uploads.get(uploadId) : null;
  if (!sheet || !upload || upload.ref !== sheet.id || upload.kind !== "worksheet") return null;
  return { sheet, upload };
}

/** Transcription by the vision model (spec A 6.1 step 2). Nothing is judged here. */
const lesen: ModuleAction = async (ctx, form) => {
  const found = await sheetAndUpload(ctx, form);
  if (!found) return home(ctx);
  const { sheet, upload } = found;
  const back = { redirect: `${ctx.basePath}/blatt/${sheet.id}/pruefen?upload=${upload.id}` };
  if (await transcriptOf(ctx, upload.id)) return back;

  const images = await ctx.uploads.images(upload.id);
  if (images.length === 0) {
    await addTranscript(ctx, upload.id, { failure: "no_images" }, null);
    return back;
  }
  const input = transcribeInput({ sheetCode: sheet.sheetCode, level: sheet.niveau, taskIds: sheet.taskIds, params: sheet.params });
  const result = await ctx.ai.generate({
    prompt: "transcribe",
    variables: { sheet_code: sheet.sheetCode, task_ids: sheet.taskIds.join(", ") },
    input,
    images,
    schema: aiTranscriptionSchema,
  });
  if (result.ok) {
    const confidences = result.data.tasks.filter((t) => t.found).map((t) => t.transcription_confidence);
    await addTranscript(
      ctx,
      upload.id,
      { transcription: result.data, prompt_name: result.promptName, prompt_version: result.promptVersion, model: result.model },
      confidences.length > 0 ? Math.min(...confidences) : 0,
    );
  } else {
    // D-014: no other model; the confirm screen offers a new photo or typing the results.
    await addTranscript(ctx, upload.id, { failure: result.reason, prompt_name: result.promptName, prompt_version: result.promptVersion }, null);
  }
  return back;
};

/**
 * The learner confirms or corrects the transcription; then code verifies every task (D-006,
 * D-018) and the light model phrases the feedback (spec A 6.1 steps 3 to 6).
 */
const bestaetigen: ModuleAction = async (ctx, form) => {
  const found = await sheetAndUpload(ctx, form);
  if (!found) return home(ctx);
  const { sheet, upload } = found;
  const resultPage = { redirect: `${ctx.basePath}/blatt/${sheet.id}/ergebnis` };
  if ((await resultsOfSheet(ctx, sheet.id)).length > 0) return resultPage;
  const stored = await transcriptOf(ctx, upload.id);
  if (!stored) return { redirect: `${ctx.basePath}/blatt/${sheet.id}/pruefen?upload=${upload.id}` };

  const level = sheet.niveau;
  const prior = asPrior(await resultsOf(ctx, sheet.taskIds));
  let changed = 0;
  let total = 0;
  const evaluated = sheet.taskIds.map((taskId, i) => {
    const task = getTask(taskId);
    const params = sheet.params[taskId] ?? {};
    const read = transcribedFor(stored.transcription, taskId, i + 1);
    const values: Record<string, string> = {};
    const units: Record<string, string> = {};
    for (const quantity of task.levels[level]?.sought ?? []) {
      values[quantity] = field(form, `v.${taskId}.${quantity}`).slice(0, 30);
      units[quantity] = field(form, `u.${taskId}.${quantity}`).slice(0, 12);
    }
    const confirmed = confirmTask(task, level, read, {
      values,
      units,
      sketch: field(form, `skizze.${taskId}`) === "ja",
      sentence: field(form, `satz.${taskId}`) === "ja",
    }, parseDecimal);
    const share = changedShare(task, level, read, confirmed);
    changed += share.changed;
    total += share.total;
    const result = verify(task, params, level, confirmed);
    const failedSoFar = failedAttempts(prior, taskId) + (result.status === "correct" ? 0 : 1);
    return { task, params, confirmed, result, next: nextAction(result.status, failedSoFar), attemptNo: sheet.attempts[taskId] ?? 1 };
  });
  await confirmTranscript(ctx, stored.id, { sheet_code: sheet.sheetCode, tasks: evaluated.map((e) => e.confirmed) }, total > 0 ? changed / total : 0);

  const phrased = await Promise.all(
    evaluated.map(async (e): Promise<{ feedbackId: string | null; source: string }> => {
      const answer = await ctx.ai.generate({
        prompt: "feedback",
        input: feedbackInput(e.task, level, e.params, e.confirmed, e.result, e.next),
        schema: aiFeedbackSchema,
      });
      if (!answer.ok) return { feedbackId: null, source: answer.reason };
      const text: AiFeedback = enforceDecisions(answer.data, e.task, e.result, e.next);
      if (revealsResult(text, e.task, level, e.params, e.confirmed)) return { feedbackId: null, source: "reveal_guard" };
      const feedbackId = await addFeedback(ctx, {
        uploadId: upload.id,
        promptName: answer.promptName,
        promptVersion: answer.promptVersion,
        model: answer.model,
        payload: text,
      });
      return { feedbackId, source: "ai" };
    }),
  );

  try {
    await addResults(
      ctx,
      evaluated.map((e, i) => ({
        worksheetId: sheet.id,
        uploadId: upload.id,
        transcriptId: stored.id,
        taskId: e.task.id,
        attemptNo: e.attemptNo,
        status: e.result.status,
        misconceptionCodes: e.result.matched_misconceptions,
        verification: e.result,
        feedbackId: phrased[i]!.feedbackId,
        feedbackSource: phrased[i]!.source,
      })),
    );
  } catch (error) {
    // A second submit of the same sheet hits the unique index; the first one already stored everything.
    if ((await resultsOfSheet(ctx, sheet.id)).length === 0) throw error;
  }
  return resultPage;
};

/** Opens the full solution after the second failed attempt and logs it (spec A 2.3). */
const loesung: ModuleAction = async (ctx, form) => {
  const sheet = await worksheet(ctx, field(form, "blatt"));
  if (!sheet) return home(ctx);
  const taskId = field(form, "task");
  const results = await resultsOf(ctx, [taskId]);
  const own = results.find((r) => r.worksheetId === sheet.id);
  if (!own || !solutionAvailable(asPrior(results), taskId)) return { redirect: `${ctx.basePath}/blatt/${sheet.id}/ergebnis` };
  if (!own.solutionViewed) await markSolutionViewed(ctx, own.id);
  return { redirect: `${ctx.basePath}/blatt/${sheet.id}/loesung/${taskId}` };
};

/** Deletes the photos of an upload right away; transcript and feedback stay (D-027). */
const fotosLoeschen: ModuleAction = async (ctx, form) => {
  const found = await sheetAndUpload(ctx, form);
  if (!found) return home(ctx);
  await ctx.uploads.deleteImages(found.upload.id);
  return { redirect: `${ctx.basePath}/blatt/${found.sheet.id}/ergebnis?fotos=geloescht` };
};

export const ACTIONS: Record<string, ModuleAction> = {
  niveau,
  rechner,
  luecke,
  blatt_oeffnen: blattOeffnen,
  neu,
  lesen,
  bestaetigen,
  loesung,
  fotos_loeschen: fotosLoeschen,
};
