import { describe, expect, it } from "vitest";
import { pickPrompt } from "@denkraum/sdk";
import {
  aiFeedbackSchema,
  aiTranscriptionSchema,
  changedShare,
  confirmTask,
  enforceDecisions,
  feedbackInput,
  mockFeedback,
  mockTranscription,
  needsNewPhoto,
  parseRequestInput,
  revealsResult,
  transcribedFor,
  transcribeInput,
  type AiFeedback,
  type AiTranscription,
} from "../domain/ai.ts";
import { parseDecimal } from "../domain/format.ts";
import { lessonTasks, nextAction, planWorksheet } from "../domain/lesson.ts";
import { getTask } from "../domain/tasks.ts";
import { verify } from "../domain/verify.ts";
import { PROMPTS } from "../prompts/index.ts";

/** What goes to the model and what comes back, with the mock answers used in CI (spec A 6). */

const { paper } = lessonTasks(4);
const plan = planWorksheet(paper, "ai-test", []);
const sheet = { sheetCode: plan.sheetCode, level: "M" as const, taskIds: plan.taskIds, params: plan.params };

describe("prompts", () => {
  it("are versioned files with frontmatter: transcribe on the vision tier, feedback on the light tier", () => {
    const transcribe = pickPrompt(PROMPTS, "transcribe");
    const feedback = pickPrompt(PROMPTS, "feedback");
    expect(transcribe).toMatchObject({ name: "transcribe", version: 1, model_tier: "vision" });
    expect(feedback).toMatchObject({ name: "feedback", version: 1, model_tier: "light" });
    expect(transcribe.body).toContain("{{task_ids}}");
    expect(transcribe.body).toContain("Bewerte nichts, korrigiere nichts");
    expect(feedback.body).toContain("Verrate nie das Endergebnis");
  });

  it("contain no en or em dash", () => {
    expect(Object.values(PROMPTS).join("\n")).not.toMatch(/[\u2013\u2014]/);
  });
});

describe("transcription input", () => {
  const input = transcribeInput(sheet);

  it("carries task texts with the numbers, the sought quantities and no solution", () => {
    expect(input.tasks.map((t) => [t.task_id, t.number])).toEqual([
      ["L4-A2", 1],
      ["L4-A5", 2],
      ["L4-A6", 3],
      ["L4-A7", 4],
    ]);
    expect(input.tasks[0]!.sought).toEqual([
      { quantity: "a", unit: "cm" },
      { quantity: "b", unit: "cm" },
    ]);
    expect(input.tasks[3]!.sought).toEqual([
      { quantity: "h", unit: "m" },
      { quantity: "d", unit: "m" },
    ]);
    expect(input.tasks[0]!.text).toContain(`c = ${String(plan.params["L4-A2"]!.c).replace(".", ",")} cm`);
    expect(JSON.stringify(input)).not.toMatch(/learner|pseudonym|group|seed/i);
  });

  it("has a mock answer that reads every task correctly and fits the schema", () => {
    const answer = mockTranscription(parseRequestInput(JSON.stringify(input, null, 2)) as typeof input);
    expect(aiTranscriptionSchema.safeParse(answer).success).toBe(true);
    for (const [i, id] of sheet.taskIds.entries()) {
      const task = getTask(id);
      const read = transcribedFor(answer, id, i + 1);
      const confirmed = confirmTask(task, "M", read, {
        values: Object.fromEntries((read?.final_answers ?? []).map((a) => [a.quantity, String(a.value).replace(".", ",")])),
        units: Object.fromEntries((read?.final_answers ?? []).map((a) => [a.quantity, a.unit ?? ""])),
        sketch: true,
        sentence: true,
      }, parseDecimal);
      expect(verify(task, sheet.params[id]!, "M", confirmed).status, id).toBe("correct");
    }
    expect(needsNewPhoto(answer)).toBe(false);
  });

  it("parses the request even with the retry note the platform appends", () => {
    const text = `${JSON.stringify({ a: 1 })}\n\nDeine vorige Antwort passte nicht zum Schema (x: y). Antworte nur mit gültigem JSON nach dem Schema.`;
    expect(parseRequestInput(text)).toEqual({ a: 1 });
  });
});

describe("transcription schema and confirm screen", () => {
  const read: AiTranscription = mockTranscription(transcribeInput(sheet));

  it("limits free text and checks the photo quality values", () => {
    const long = structuredClone(read);
    long.tasks[0]!.raw_text = "x".repeat(3001);
    expect(aiTranscriptionSchema.safeParse(long).success).toBe(false);
    const bad = { ...read, photo_quality_issue: "foggy" };
    expect(aiTranscriptionSchema.safeParse(bad).success).toBe(false);
  });

  it("asks for a new photo on a quality issue or low confidence (spec A 5.6)", () => {
    expect(needsNewPhoto({ ...read, photo_quality_issue: "blur" })).toBe(true);
    const unsure = structuredClone(read);
    unsure.tasks[1]!.transcription_confidence = 0.4;
    expect(needsNewPhoto(unsure)).toBe(true);
    expect(needsNewPhoto({ ...read, tasks: read.tasks.map((t) => ({ ...t, found: false })) })).toBe(true);
    expect(needsNewPhoto(null)).toBe(true);
  });

  it("matches tasks by id, or by number when the model wrote the number", () => {
    const byNumber = { ...read, tasks: [{ ...read.tasks[2]!, task_id: "3" }] };
    expect(transcribedFor(byNumber, "L4-A6", 3)?.task_id).toBe("3");
    expect(transcribedFor(byNumber, "L4-A2", 1)).toBeUndefined();
  });

  it("takes values, units, sketch and sentence from the form and keeps the intermediate values as read", () => {
    const task = getTask("L4-A2");
    const original = { ...read.tasks[0]!, intermediate_values: [{ label: "sin 35°", value: 0.5736 }] };
    const confirmed = confirmTask(task, "M", original, { values: { a: "-3,43", b: "" }, units: { a: "cm", b: "cm" }, sketch: false, sentence: true }, parseDecimal);
    expect(confirmed.final_answers).toEqual([{ quantity: "a", value: -3.43, unit: "cm" }]);
    expect(confirmed.intermediate_values).toEqual(original.intermediate_values);
    expect(confirmed.sketch_present).toBe(false);
    expect(changedShare(task, "M", original, confirmed)).toEqual({ changed: 4, total: 6 });
  });

  it("counts a task as found when the learner typed values for a task the model missed", () => {
    const task = getTask("L4-A5");
    const confirmed = confirmTask(task, "G", undefined, { values: { a: "4,2" }, units: { a: "cm" }, sketch: true, sentence: true }, parseDecimal);
    expect(confirmed.found).toBe(true);
    const empty = confirmTask(task, "G", undefined, { values: {}, units: {}, sketch: false, sentence: false }, parseDecimal);
    expect(verify(task, { b: 6, alpha: 35 }, "G", empty).status).toBe("not_found");
  });
});

describe("feedback", () => {
  const task = getTask("L4-A2");
  const params = { c: 8, alpha: 35 };
  const wrong = confirmTask(task, "G", undefined, { values: { a: "-3,43" }, units: { a: "cm" }, sketch: true, sentence: true }, parseDecimal);
  const result = verify(task, params, "G", wrong);
  const input = feedbackInput(task, "G", params, wrong, result, nextAction(result.status, 1));

  it("gets the model solution, the verification and the catalog entries of the codes found", () => {
    expect(result.matched_misconceptions).toEqual(["F1"]);
    expect(input.verification.misconception_codes).toEqual(["F1"]);
    expect(input.catalog).toEqual([{ code: "F1", label: "Taschenrechner nicht auf DEG", hint: "Stell deinen Rechner auf DEG und prüfe mit sin 30° = 0,5." }]);
    expect(input.model_solution.values.a).toBe("4,59");
    expect(input.next_action).toBe("retry_new_numbers");
  });

  it("has a mock answer that fits the schema and never gives the result away", () => {
    const answer = mockFeedback(parseRequestInput(JSON.stringify(input)) as typeof input);
    expect(aiFeedbackSchema.safeParse(answer).success).toBe(true);
    expect(answer.hint).toBe("Stell deinen Rechner auf DEG und prüfe mit sin 30° = 0,5.");
    expect(revealsResult(answer, task, "G", params, wrong)).toBe(false);
  });

  it("is rejected when it names the result of a value the learner has not got right (spec A 2.3)", () => {
    const leak = (hint: string): AiFeedback => ({ ...mockFeedback(input), hint });
    expect(revealsResult(leak("Richtig wäre a = 4,59 cm."), task, "G", params, wrong)).toBe(true);
    expect(revealsResult(leak("Es kommt ungefähr 4.6 heraus."), task, "G", params, wrong)).toBe(true);
    expect(revealsResult(leak("Prüfe mit sin 30° = 0,5."), task, "G", params, wrong)).toBe(false);
    expect(revealsResult(leak("Die Seite ist 14,59 cm lang."), task, "G", params, wrong)).toBe(false);
    // A value the learner already has right may be repeated.
    const right = confirmTask(task, "G", undefined, { values: { a: "4,59" }, units: { a: "cm" }, sketch: true, sentence: true }, parseDecimal);
    expect(revealsResult(leak("Dein Ergebnis 4,59 cm stimmt."), task, "G", params, right)).toBe(false);
  });

  it("cannot change status, codes or next step: code decides (D-006)", () => {
    const claimed: AiFeedback = { ...mockFeedback(input), status: "correct", misconception_codes: ["F3"], next_action: "next_task" };
    expect(enforceDecisions(claimed, task, result, "retry_new_numbers")).toMatchObject({
      task_id: "L4-A2",
      status: "incorrect",
      misconception_codes: ["F1"],
      next_action: "retry_new_numbers",
    });
  });

  it("limits the length of every text field", () => {
    expect(aiFeedbackSchema.safeParse({ ...mockFeedback(input), hint: "x".repeat(401) }).success).toBe(false);
    expect(aiFeedbackSchema.safeParse({ ...mockFeedback(input), headline: "" }).success).toBe(false);
  });
});
