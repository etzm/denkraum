import { describe, expect, it } from "vitest";
import { lessonPassed, lessonTasks, solutionAvailable, tasksForNextSheet } from "../domain/lesson.ts";
import { activeOverride, applyOverrides, countedResults, parseOverride, type OverrideEntry, type ResultEntry } from "../domain/overrides.ts";

// Teacher corrections (D-031, T-43): the lesson rules work on the corrected results.

const at = (minute: number) => new Date(Date.UTC(2026, 9, 20, 8, minute));

function result(id: string, taskId: string, attemptNo: number, status: ResultEntry["status"], minute: number, codes: string[] = []): ResultEntry {
  return { id, taskId, attemptNo, status, misconceptionCodes: codes, solutionViewed: false, createdAt: at(minute) };
}

function override(resultId: string, kind: OverrideEntry["kind"], minute: number, status: OverrideEntry["status"] = null): OverrideEntry {
  return { resultId, kind, status, reason: "Foto falsch gelesen", createdAt: at(minute) };
}

const { paper } = lessonTasks(4);
const [A2, A5, A6] = paper.map((t) => t.id);

describe("activeOverride", () => {
  it("takes the latest entry and lets 'clear' take a correction back", () => {
    const log = [override("r1", "status", 10, "correct"), override("r1", "void", 20)];
    expect(activeOverride(log, "r1")).toMatchObject({ kind: "void", status: null });
    expect(activeOverride([...log, override("r1", "clear", 30)], "r1")).toBeNull();
    expect(activeOverride(log, "r2")).toBeNull();
  });
});

describe("applyOverrides", () => {
  it("sets the status and drops the codes when the teacher marks a result correct", () => {
    const results = [result("r1", A2!, 1, "incorrect", 1, ["F2", "F3"])];
    const [effective] = applyOverrides(results, [override("r1", "status", 5, "correct")]);
    expect(effective).toMatchObject({ status: "correct", originalStatus: "incorrect", codes: [], counted: true, attemptNo: 1 });
    const [partial] = applyOverrides(results, [override("r1", "status", 5, "partially_correct")]);
    expect(partial!.codes).toEqual(["F2", "F3"]);
  });

  it("moves an attempt that does not count out of the numbering", () => {
    const results = [result("r1", A2!, 1, "incorrect", 1), result("r2", A2!, 2, "incorrect", 2), result("r3", A2!, 3, "correct", 3), result("r4", A5!, 1, "correct", 1)];
    const effective = applyOverrides(results, [override("r1", "void", 9)]);
    expect(effective.map((r) => [r.resultId, r.attemptNo, r.counted])).toEqual([
      ["r1", 1, false],
      ["r2", 1, true],
      ["r3", 2, true],
      ["r4", 1, true],
    ]);
  });

  it("feeds the lesson rules: an attempt that does not count gives another chance", () => {
    const results = [
      result("a1", A2!, 1, "incorrect", 1),
      result("a2", A2!, 2, "incorrect", 2),
      result("a3", A2!, 3, "correct", 3),
      result("b1", A5!, 1, "correct", 1),
      result("c1", A6!, 1, "correct", 1),
    ];
    expect(lessonPassed(paper, countedResults(applyOverrides(results, [])))).toBe(false);
    expect(solutionAvailable(countedResults(applyOverrides(results, [])), A2!)).toBe(true);

    const corrected = countedResults(applyOverrides(results, [override("a1", "void", 9)]));
    expect(lessonPassed(paper, corrected)).toBe(true);
    expect(solutionAvailable(corrected, A2!)).toBe(false);
  });

  it("removes a task from the next sheet once the teacher marks it correct", () => {
    const results = [result("a1", A2!, 1, "incorrect", 1)];
    expect(tasksForNextSheet(paper, countedResults(applyOverrides(results, []))).map((t) => t.id)).toContain(A2);
    const corrected = countedResults(applyOverrides(results, [override("a1", "status", 5, "correct")]));
    expect(tasksForNextSheet(paper, corrected).map((t) => t.id)).not.toContain(A2);
  });
});

describe("parseOverride", () => {
  const input = (kind: string, status = "", reason = "Einheit stand am Rand") => ({ kind, status, reason });

  it("accepts a new status, a void and a clear with a reason", () => {
    expect(parseOverride(input("status", "correct"), null, "incorrect")).toEqual({
      ok: true,
      request: { kind: "status", status: "correct", reason: "Einheit stand am Rand" },
    });
    expect(parseOverride(input("void"), null, "incorrect")).toMatchObject({ ok: true, request: { kind: "void" } });
    const current = { kind: "void" as const, status: null, reason: "x", createdAt: at(1) };
    expect(parseOverride(input("clear"), current, "incorrect")).toMatchObject({ ok: true, request: { kind: "clear" } });
  });

  it("trims the reason and requires 5 to 300 characters", () => {
    expect(parseOverride(input("void", "", "  Foto   unscharf  "), null, "incorrect")).toMatchObject({ request: { reason: "Foto unscharf" } });
    expect(parseOverride(input("void", "", " ok "), null, "incorrect")).toEqual({ ok: false, error: "reason" });
    expect(parseOverride(input("void", "", "x".repeat(301)), null, "incorrect")).toEqual({ ok: false, error: "reason" });
  });

  it("refuses unknown values and corrections that change nothing", () => {
    expect(parseOverride(input("delete"), null, "incorrect")).toEqual({ ok: false, error: "kind" });
    expect(parseOverride(input("status", "great"), null, "incorrect")).toEqual({ ok: false, error: "status" });
    expect(parseOverride(input("status", "incorrect"), null, "incorrect")).toEqual({ ok: false, error: "unchanged" });
    expect(parseOverride(input("clear"), null, "incorrect")).toEqual({ ok: false, error: "unchanged" });
    const voided = { kind: "void" as const, status: null, reason: "x", createdAt: at(1) };
    expect(parseOverride(input("void"), voided, "incorrect")).toEqual({ ok: false, error: "unchanged" });
    // From "does not count" back to counting with the original status is a change.
    expect(parseOverride(input("status", "incorrect"), voided, "incorrect")).toMatchObject({ ok: true });
  });
});
