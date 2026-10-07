import { describe, expect, it } from "vitest";
import { formatGiven, formatInput, formatNumber, formatValue, parseDecimal, renderText, textVariables } from "../domain/format.ts";
import {
  calculatorCheck,
  catalogHint,
  checkFaded,
  failedAttempts,
  fadedState,
  hiddenSteps,
  hintOrder,
  lessonPassed,
  lessonTasks,
  nextAction,
  planWorksheet,
  sheetCode,
  solutionAvailable,
  statusLabel,
  tasksForNextSheet,
  worksheetUnlocked,
  type PriorResult,
} from "../domain/lesson.ts";
import { createRng } from "../domain/random.ts";
import { getTask } from "../domain/tasks.ts";

/** Rules of the lesson 4 flow: code decides what is right and what unlocks (D-006). */

describe("number format", () => {
  it("reads decimal comma, decimal point, minus signs and blanks", () => {
    expect(parseDecimal("4,59")).toBe(4.59);
    expect(parseDecimal(" 4.6 ")).toBe(4.6);
    expect(parseDecimal("-3,43")).toBe(-3.43);
    expect(parseDecimal("−3,43")).toBe(-3.43);
    expect(parseDecimal("12")).toBe(12);
    expect(parseDecimal(",5")).toBe(0.5);
  });

  it("rejects empty and non-numeric input", () => {
    for (const bad of ["", "  ", "abc", "4,5,6", "4 cm", "1e3", null, undefined]) expect(parseDecimal(bad)).toBeNull();
  });

  it("shows decimal commas, 2 decimals for lengths, 4 for ratios, given values without trailing zeros", () => {
    expect(formatNumber(4.5886, 2)).toBe("4,59");
    expect(formatValue(0.57358, "")).toBe("0,5736");
    expect(formatValue(4.5886, "cm")).toBe("4,59");
    expect(formatGiven(8)).toBe("8");
    expect(formatGiven(7.5)).toBe("7,5");
    expect(formatNumber(-3.4255, 2)).toBe("−3,43");
    expect(formatInput(4.6)).toBe("4,6");
    expect(formatInput(-3.43)).toBe("-3,43");
    expect(formatInput(null)).toBe("");
  });

  it("fills task texts with the learner's numbers", () => {
    const task = getTask("L4-A2");
    const vars = textVariables(task, "M", { c: 8, alpha: 35 });
    expect(renderText(task.levels.M!.steps[2]!, vars)).toBe("a = 8 cm · sin 35° ≈ 4,59 cm");
    expect(renderText(task.levels.M!.steps[4]!, vars)).toBe("b = 8 cm · cos 35° ≈ 6,55 cm");
  });
});

describe("lesson 4 tasks", () => {
  it("are 1 worked example, 2 faded tasks and 4 paper tasks", () => {
    const { worked, faded, paper } = lessonTasks(4);
    expect(worked?.id).toBe("L4-A1");
    expect(faded.map((t) => t.id)).toEqual(["L4-A3", "L4-A4"]);
    expect(paper.map((t) => t.id)).toEqual(["L4-A2", "L4-A5", "L4-A6", "L4-A7"]);
  });
});

describe("faded tasks", () => {
  const l4a3 = getTask("L4-A3");
  const l4a4 = getTask("L4-A4");

  it("split hidden steps into choices and typed values", () => {
    const m = hiddenSteps(l4a3, "M");
    expect(m.map((s) => s.kind)).toEqual(["choice", "value"]);
    const choice = m[0]!;
    if (choice.kind !== "choice") throw new Error("expected a choice");
    expect(choice.correct).toBe("Umstellen: b = c · sin β");
    expect([...choice.options].sort()).toEqual(["Umstellen: b = c : sin β", "Umstellen: b = c · sin β", "Umstellen: b = sin β : c"].sort());
    expect(hiddenSteps(l4a3, "M")).toEqual(m);
    const value = m[1]!;
    expect(value).toMatchObject({ kind: "value", quantity: "b", before: "Ergebnis: b = {{c}} cm · sin {{beta}}° ≈ ", after: " cm" });
    expect(hiddenSteps(l4a3, "G").map((s) => s.kind)).toEqual(["value"]);
    expect(hiddenSteps(l4a4, "E").map((s) => s.kind)).toEqual(["choice", "choice", "value"]);
  });

  it("accept the right value with other rounding and the right choice", () => {
    expect(checkFaded(l4a3, "G", { "3": "7,66" }, 0)).toMatchObject({ correct: true, hint: null });
    expect(checkFaded(l4a3, "G", { "3": "7,7" }, 0).correct).toBe(true);
    expect(checkFaded(l4a3, "M", { "2": "Umstellen: b = c · sin β", "3": "7,66" }, 0).correct).toBe(true);
    expect(checkFaded(l4a4, "E", { "1": "Ansatz: tan α = a/b", "2": "Umstellen: a = b · tan α", "3": "4,2" }, 0).correct).toBe(true);
  });

  it("recognise a known error in the typed value and give its catalog hint", () => {
    // 10 · cos 50° = 6.43: cosine instead of sine.
    const cos = checkFaded(l4a3, "G", { "3": "6,43" }, 0);
    expect(cos).toMatchObject({ correct: false, codes: ["F2", "F3"] });
    expect(cos.hint).toBe("Welche Seite liegt dem Winkel gegenüber? Markiere sie farbig in deiner Skizze.");
    // 10 · sin(50 rad) = -2.62: RAD mode.
    expect(checkFaded(l4a3, "G", { "3": "-2,62" }, 0).codes).toEqual(["F1"]);
  });

  it("give the task hints in order when no known error fits", () => {
    const wrongChoice = { "2": "Umstellen: b = sin β : c", "3": "7,66" };
    const first = checkFaded(l4a3, "M", wrongChoice, 0);
    expect(first.correct).toBe(false);
    expect(first.steps).toEqual([
      { index: 2, correct: false },
      { index: 3, correct: true },
    ]);
    expect(first.hint).toBe(l4a3.hints[0]);
    expect(checkFaded(l4a3, "M", wrongChoice, 1).hint).toBe(l4a3.hints[1]);
    expect(checkFaded(l4a3, "M", wrongChoice, 7).hint).toBe(l4a3.hints.at(-1));
    expect(checkFaded(l4a3, "G", { "3": "" }, 0).correct).toBe(false);
  });

  it("are done when solved or after 3 wrong attempts, then marked 'mit Hilfe'", () => {
    expect(fadedState([])).toEqual({ solved: false, wrong: 0, done: false, withHelp: false });
    expect(fadedState([{ correct: false }, { correct: true }])).toMatchObject({ solved: true, done: true, withHelp: false });
    expect(fadedState([{ correct: false }, { correct: false }])).toMatchObject({ done: false });
    expect(fadedState([{ correct: false }, { correct: false }, { correct: false }])).toMatchObject({ done: true, withHelp: true });
  });

  it("unlock the worksheet only when both are done", () => {
    const solved = fadedState([{ correct: true }]);
    const helped = fadedState([{ correct: false }, { correct: false }, { correct: false }]);
    const open = fadedState([{ correct: false }]);
    expect(worksheetUnlocked([solved, solved])).toEqual({ open: true, withHelp: false });
    expect(worksheetUnlocked([solved, helped])).toEqual({ open: true, withHelp: true });
    expect(worksheetUnlocked([solved, open]).open).toBe(false);
    expect(worksheetUnlocked([]).open).toBe(false);
  });
});

describe("calculator check", () => {
  it("tells DEG, RAD and GRAD apart (spec A 3, sin 30°)", () => {
    expect(calculatorCheck("0,5")).toBe("deg");
    expect(calculatorCheck("-0,988")).toBe("rad");
    expect(calculatorCheck("-0,99")).toBe("rad");
    expect(calculatorCheck("0,454")).toBe("grad");
    expect(calculatorCheck("0,7")).toBe("other");
    expect(calculatorCheck("")).toBeNull();
  });
});

describe("worksheets", () => {
  const { paper } = lessonTasks(4);

  it("have a 4 character sheet code without 0, O, 1 and I", () => {
    const rng = createRng("codes");
    for (let i = 0; i < 500; i++) expect(sheetCode(rng)).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
  });

  it("are deterministic per seed and differ between seeds", () => {
    expect(planWorksheet(paper, "seed-1", [])).toEqual(planWorksheet(paper, "seed-1", []));
    const a = planWorksheet(paper, "seed-1", []);
    const b = planWorksheet(paper, "seed-2", []);
    expect(a.params).not.toEqual(b.params);
    expect(a.taskIds).toEqual(["L4-A2", "L4-A5", "L4-A6", "L4-A7"]);
    expect(a.attempts).toEqual({ "L4-A2": 1, "L4-A5": 1, "L4-A6": 1, "L4-A7": 1 });
  });

  it("count attempts per task and retry only what is not right yet", () => {
    const prior: PriorResult[] = [
      { taskId: "L4-A2", attemptNo: 1, status: "incorrect" },
      { taskId: "L4-A5", attemptNo: 1, status: "correct" },
      { taskId: "L4-A6", attemptNo: 1, status: "partially_correct" },
      { taskId: "L4-A7", attemptNo: 1, status: "correct" },
    ];
    const next = tasksForNextSheet(paper, prior);
    expect(next.map((t) => t.id)).toEqual(["L4-A2", "L4-A6"]);
    expect(planWorksheet(next, "seed-3", prior).attempts).toEqual({ "L4-A2": 2, "L4-A6": 2 });
    const allRight = paper.map((t): PriorResult => ({ taskId: t.id, attemptNo: 1, status: "correct" }));
    expect(tasksForNextSheet(paper, allRight)).toHaveLength(4);
  });
});

describe("results", () => {
  const { paper } = lessonTasks(4);
  const r = (taskId: string, attemptNo: number, status: PriorResult["status"]): PriorResult => ({ taskId, attemptNo, status });

  it("pass the lesson with 3 of 4 paper tasks right in the first or second attempt", () => {
    expect(lessonPassed(paper, [r("L4-A2", 1, "correct"), r("L4-A5", 1, "correct")])).toBe(false);
    expect(lessonPassed(paper, [r("L4-A2", 1, "correct"), r("L4-A5", 2, "correct"), r("L4-A6", 1, "correct")])).toBe(true);
    // A third attempt does not count, "fast" does not count.
    expect(lessonPassed(paper, [r("L4-A2", 1, "correct"), r("L4-A5", 1, "correct"), r("L4-A6", 3, "correct")])).toBe(false);
    expect(lessonPassed(paper, [r("L4-A2", 1, "correct"), r("L4-A5", 1, "correct"), r("L4-A6", 1, "partially_correct")])).toBe(false);
  });

  it("open the full solution only after the second failed attempt", () => {
    const one = [r("L4-A2", 1, "incorrect")];
    const two = [...one, r("L4-A2", 2, "partially_correct")];
    expect(failedAttempts(two, "L4-A2")).toBe(2);
    expect(solutionAvailable(one, "L4-A2")).toBe(false);
    expect(solutionAvailable(two, "L4-A2")).toBe(true);
    expect(solutionAvailable(two, "L4-A5")).toBe(false);
  });

  it("decide the next step and the status shown", () => {
    expect(nextAction("correct", 3)).toBe("next_task");
    expect(nextAction("incorrect", 1)).toBe("retry_new_numbers");
    expect(nextAction("incorrect", 2)).toBe("show_solution_available");
    expect(statusLabel("correct")).toBe("richtig");
    expect(statusLabel("partially_correct")).toBe("fast");
    expect(statusLabel("incorrect")).toBe("nochmal");
    expect(statusLabel("not_found")).toBe("nochmal");
  });

  it("give the hint of the first error about the mathematics, form errors last", () => {
    expect(hintOrder(["F1", "F7", "F11"])).toEqual(["F1", "F7", "F11"]);
    expect(hintOrder(["F7", "F11", "F13"])).toEqual(["F13", "F7", "F11"]);
    expect(catalogHint({ status: "incorrect", matched_misconceptions: ["F6", "F7"], evidence: [{ detail: "", code: "F6", hint_vars: { side: "c" } }] })).toBe(
      "Multipliziere beide Seiten mit c.",
    );
    expect(catalogHint({ status: "incorrect", matched_misconceptions: [], evidence: [] })).toMatch(/Schritt für Schritt/);
    expect(catalogHint({ status: "not_found", matched_misconceptions: [], evidence: [] })).toMatch(/Aufgabennummer/);
  });
});
