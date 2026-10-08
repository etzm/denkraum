import { describe, expect, it } from "vitest";
import { lessonCodes, taskOverview, type OverviewAttempt } from "../domain/overview.ts";

// Error picture of a class (D-030, T-42): latest attempt per learner, codes with learners.

const at = (minute: number) => new Date(Date.UTC(2026, 9, 20, 8, minute));

function attempt(learnerId: string, taskId: string, attemptNo: number, status: OverviewAttempt["status"], codes: OverviewAttempt["codes"] = []): OverviewAttempt {
  return { learnerId, taskId, attemptNo, status, codes, createdAt: at(attemptNo) };
}

describe("taskOverview", () => {
  const attempts = [
    attempt("anna", "L4-A2", 1, "incorrect", ["F2", "F3"]),
    attempt("anna", "L4-A2", 2, "correct"),
    attempt("ben", "L4-A2", 1, "incorrect", ["F2", "F3"]),
    attempt("cem", "L4-A2", 1, "incorrect", ["F1"]),
    attempt("cem", "L4-A5", 1, "partially_correct", ["F7"]),
  ];

  it("counts the latest attempt per learner and every attempt per code", () => {
    const [a2, a6] = taskOverview(["L4-A2", "L4-A6"], attempts);
    expect(a2).toMatchObject({ taskId: "L4-A2", learners: 3, latest: { correct: 1, partially_correct: 0, incorrect: 2, not_found: 0 } });
    // Anna fixed F2 and F3 in her second attempt: she still counts for the attempts, not for "now".
    expect(a2!.codes.map((c) => [c.code, c.learnerIds, c.attempts])).toEqual([
      ["F2", ["ben"], 2],
      ["F3", ["ben"], 2],
      ["F1", ["cem"], 1],
    ]);
    expect(a2!.codes[2]!.label).toBe("Taschenrechner nicht auf DEG");
    expect(a6).toEqual({ taskId: "L4-A6", learners: 0, latest: { correct: 0, partially_correct: 0, incorrect: 0, not_found: 0 }, codes: [] });
  });

  it("sorts by learners now, then by attempts, then by catalog order", () => {
    const more = [...attempts, attempt("dora", "L4-A2", 1, "incorrect", ["F1"])];
    expect(taskOverview(["L4-A2"], more)[0]!.codes.map((c) => c.code)).toEqual(["F1", "F2", "F3"]);
  });
});

describe("lessonCodes", () => {
  it("adds up the tasks and counts each learner once per code", () => {
    const tasks = taskOverview(
      ["L4-A2", "L4-A5"],
      [attempt("anna", "L4-A2", 1, "incorrect", ["F7"]), attempt("anna", "L4-A5", 1, "incorrect", ["F7"]), attempt("ben", "L4-A5", 1, "incorrect", ["F2"])],
    );
    expect(lessonCodes(tasks).map((c) => [c.code, c.learnerIds, c.attempts])).toEqual([
      ["F7", ["anna"], 2],
      ["F2", ["ben"], 1],
    ]);
  });
});
