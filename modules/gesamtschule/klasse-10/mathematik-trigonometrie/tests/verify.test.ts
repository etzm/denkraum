import { describe, expect, it } from "vitest";
import type { TranscribedTask } from "../domain/schema.ts";
import { getTask } from "../domain/tasks.ts";
import { normalizeQuantity, verify } from "../domain/verify.ts";

type Answer = TranscribedTask["final_answers"][number];

function transcription(taskId: string, fields: Partial<TranscribedTask> = {}): TranscribedTask {
  return {
    task_id: taskId,
    found: true,
    sketch_present: true,
    sketch_labels_ok: "ok",
    approach: null,
    intermediate_values: [],
    final_answers: [],
    answer_sentence_present: true,
    transcription_confidence: 0.9,
    raw_text: "",
    ...fields,
  };
}

const answer = (quantity: string, value: number | null, unit: string | null): Answer => ({ quantity, value, unit });

const L4A2 = getTask("L4-A2");
const L4A2_PARAMS = { c: 8, alpha: 35 };

describe("spec A 14, item 2", () => {
  it("RAD error in L4-A2 (a = -3.43) gives F1", () => {
    const result = verify(L4A2, L4A2_PARAMS, "G", transcription("L4-A2", { final_answers: [answer("a", -3.43, "cm")] }));
    expect(result.status).toBe("incorrect");
    expect(result.matched_misconceptions).toEqual(["F1"]);
    expect(result.evidence.some((e) => e.code === "F1" && e.wrong_path === "rad_mode")).toBe(true);
  });

  it("swapped legs in L5-A1 (α = 59.04°) give F2", () => {
    const result = verify(
      getTask("L5-A1"),
      { a: 3, b: 5 },
      "M",
      transcription("L5-A1", { final_answers: [answer("α", 59.04, "°"), answer("β", 30.96, "°")] }),
    );
    expect(result.status).toBe("incorrect");
    expect(result.matched_misconceptions).toEqual(["F2"]);
  });

  it("12° instead of 6.8° in L6-A3 gives F12", () => {
    const result = verify(getTask("L6-A3"), { p: 12 }, "M", transcription("L6-A3", { final_answers: [answer("alpha", 12, "°")] }));
    expect(result.status).toBe("incorrect");
    expect(result.matched_misconceptions).toEqual(["F12"]);
    expect(result.evidence.find((e) => e.code === "F12")?.hint_vars).toEqual({ percent: "12" });
  });

  it("the right solution with other rounding (4.6 instead of 4.59) is correct", () => {
    const g = verify(L4A2, L4A2_PARAMS, "G", transcription("L4-A2", { final_answers: [answer("a", 4.6, "cm")] }));
    expect(g).toMatchObject({ status: "correct", matched_misconceptions: [] });
    const m = verify(
      L4A2,
      L4A2_PARAMS,
      "M",
      transcription("L4-A2", { final_answers: [answer("a", 4.6, "cm"), answer("b", 6.6, "cm")] }),
    );
    expect(m).toMatchObject({ status: "correct", matched_misconceptions: [] });
  });

  it("a missing unit gives F7 with partially_correct", () => {
    const result = verify(L4A2, L4A2_PARAMS, "G", transcription("L4-A2", { final_answers: [answer("a", 4.59, null)] }));
    expect(result.status).toBe("partially_correct");
    expect(result.matched_misconceptions).toEqual(["F7"]);
  });
});

describe("form: unit, answer sentence, sketch", () => {
  const right = [answer("a", 4.59, "cm"), answer("b", 6.55, "cm")];

  it("a complete right solution is correct", () => {
    const result = verify(L4A2, L4A2_PARAMS, "E", transcription("L4-A2", { final_answers: right }));
    expect(result).toMatchObject({ status: "correct", matched_misconceptions: [] });
  });

  it("a missing answer sentence gives F7 with partially_correct", () => {
    const result = verify(
      L4A2,
      L4A2_PARAMS,
      "M",
      transcription("L4-A2", { final_answers: right, answer_sentence_present: false }),
    );
    expect(result).toMatchObject({ status: "partially_correct", matched_misconceptions: ["F7"] });
  });

  it("a wrong unit gives F7", () => {
    const result = verify(L4A2, L4A2_PARAMS, "G", transcription("L4-A2", { final_answers: [answer("a", 4.59, "m")] }));
    expect(result).toMatchObject({ status: "partially_correct", matched_misconceptions: ["F7"] });
  });

  it("accepts unit spellings such as Grad for °", () => {
    const result = verify(getTask("L6-A3"), { p: 12 }, "M", transcription("L6-A3", { final_answers: [answer("α", 6.8, "Grad")] }));
    expect(result).toMatchObject({ status: "correct", matched_misconceptions: [] });
  });

  it("a missing sketch gives F11, never incorrect when the values are right", () => {
    const result = verify(L4A2, L4A2_PARAMS, "M", transcription("L4-A2", { final_answers: right, sketch_present: false }));
    expect(result).toMatchObject({ status: "partially_correct", matched_misconceptions: ["F11"] });
  });

  it("wrong sketch labels give F11, unclear labels give nothing", () => {
    const wrong = verify(L4A2, L4A2_PARAMS, "M", transcription("L4-A2", { final_answers: right, sketch_labels_ok: "wrong" }));
    expect(wrong).toMatchObject({ status: "partially_correct", matched_misconceptions: ["F11"] });
    const unclear = verify(L4A2, L4A2_PARAMS, "M", transcription("L4-A2", { final_answers: right, sketch_labels_ok: "unclear" }));
    expect(unclear.status).toBe("correct");
  });

  it("form errors are reported together with a wrong value, the status stays incorrect", () => {
    const result = verify(
      L4A2,
      L4A2_PARAMS,
      "G",
      transcription("L4-A2", { final_answers: [answer("a", -3.43, null)], sketch_present: false }),
    );
    expect(result).toMatchObject({ status: "incorrect", matched_misconceptions: ["F1", "F7", "F11"] });
  });

  it("digital tasks need no unit and no answer sentence", () => {
    const result = verify(
      getTask("L4-A3"),
      { c: 10, beta: 50 },
      "G",
      transcription("L4-A3", { final_answers: [answer("b", 7.66, null)], answer_sentence_present: false, sketch_present: false }),
    );
    expect(result).toMatchObject({ status: "correct", matched_misconceptions: [] });
  });
});

describe("wrong paths", () => {
  it("cos instead of sin gives F2 and F3", () => {
    const result = verify(L4A2, L4A2_PARAMS, "G", transcription("L4-A2", { final_answers: [answer("a", 6.55, "cm")] }));
    expect(result).toMatchObject({ status: "incorrect", matched_misconceptions: ["F2", "F3"] });
  });

  it("sin α / c gives F6 with the hint variable", () => {
    const result = verify(L4A2, L4A2_PARAMS, "G", transcription("L4-A2", { final_answers: [answer("a", 0.07, "cm")] }));
    expect(result.matched_misconceptions).toEqual(["F6"]);
    expect(result.evidence.find((e) => e.code === "F6")?.hint_vars).toEqual({ side: "c" });
  });

  it("GRAD mode gives F1", () => {
    const result = verify(L4A2, L4A2_PARAMS, "G", transcription("L4-A2", { final_answers: [answer("a", 4.18, "cm")] }));
    expect(result.matched_misconceptions).toEqual(["F1"]);
  });

  it("a negative length without a matching path still gives F1", () => {
    const result = verify(L4A2, L4A2_PARAMS, "G", transcription("L4-A2", { final_answers: [answer("a", -2, "cm")] }));
    expect(result).toMatchObject({ status: "incorrect", matched_misconceptions: ["F1"] });
  });

  it("1/sin instead of sin⁻¹ gives F4 (L5-A2)", () => {
    const result = verify(getTask("L5-A2"), { c: 10, a: 6 }, "G", transcription("L5-A2", { final_answers: [answer("alpha", 1.67, "°")] }));
    expect(result.matched_misconceptions).toEqual(["F4"]);
    expect(result.evidence.find((e) => e.code === "F4")?.hint_vars).toEqual({ fn: "sin" });
  });

  it("Pythagoras with the ladder as a leg gives F8 (L6-A2)", () => {
    const result = verify(
      getTask("L6-A2"),
      { ladder: 4, distance: 1.2 },
      "E",
      transcription("L6-A2", { final_answers: [answer("alpha", 72.5, "°"), answer("h", 4.18, "m")] }),
    );
    expect(result).toMatchObject({ status: "incorrect", matched_misconceptions: ["F8"] });
  });

  it("strahlensatz with the partial segment gives F10, divided instead of multiplied gives F6 (L1-A2)", () => {
    const task = getTask("L1-A2");
    const params = { stick: 1.5, stick_shadow: 2, tree_shadow: 12 };
    expect(verify(task, params, "G", transcription("L1-A2", { final_answers: [answer("h", 7.5, "m")] })).matched_misconceptions).toEqual(["F10"]);
    expect(verify(task, params, "G", transcription("L1-A2", { final_answers: [answer("h", 16, "m")] })).matched_misconceptions).toEqual(["F6"]);
    expect(verify(task, params, "G", transcription("L1-A2", { final_answers: [answer("h", 9, "m")] })).status).toBe("correct");
  });

  it("calculator check: -0.988 gives F1, 0.5 is correct (L3-A2)", () => {
    const task = getTask("L3-A2");
    const rad = verify(task, {}, "G", transcription("L3-A2", { final_answers: [answer("sin 30°", -0.988, null)] }));
    expect(rad).toMatchObject({ status: "incorrect", matched_misconceptions: ["F1"] });
    const deg = verify(task, {}, "G", transcription("L3-A2", { final_answers: [answer("sin 30°", 0.5, null)] }));
    expect(deg).toMatchObject({ status: "correct", matched_misconceptions: [] });
  });
});

describe("F5: early rounding, detected through intermediate values", () => {
  it("sin 35° rounded to 0.6 explains a = 4.8 cm", () => {
    const result = verify(
      L4A2,
      L4A2_PARAMS,
      "G",
      transcription("L4-A2", {
        intermediate_values: [{ label: "sin 35°", value: 0.6 }],
        final_answers: [answer("a", 4.8, "cm")],
      }),
    );
    expect(result).toMatchObject({ status: "incorrect", matched_misconceptions: ["F5"] });
  });

  it("is not detected from the final value alone", () => {
    const result = verify(L4A2, L4A2_PARAMS, "G", transcription("L4-A2", { final_answers: [answer("a", 4.8, "cm")] }));
    expect(result).toMatchObject({ status: "incorrect", matched_misconceptions: [] });
  });

  it("a rounded intermediate that keeps the result within tolerance is fine", () => {
    const result = verify(
      L4A2,
      L4A2_PARAMS,
      "G",
      transcription("L4-A2", {
        intermediate_values: [{ label: "sin 35°", value: 0.57 }],
        final_answers: [answer("a", 4.56, "cm")],
      }),
    );
    expect(result).toMatchObject({ status: "correct", matched_misconceptions: [] });
  });

  it("works for a rounded tan in L6-A1 (tan 32° ≈ 0.6, h = 31.6 m)", () => {
    const result = verify(
      getTask("L6-A1"),
      { d: 50, alpha: 32, eye: 1.6 },
      "M",
      transcription("L6-A1", {
        intermediate_values: [{ label: "tan 32°", value: 0.6 }, { label: "x", value: 30 }],
        final_answers: [answer("h", 31.6, "m")],
      }),
    );
    expect(result.matched_misconceptions).toEqual(["F5"]);
  });
});

describe("F13: approach and intermediate values right, final value off", () => {
  it("gives F13 when no other pattern matches", () => {
    const result = verify(
      L4A2,
      L4A2_PARAMS,
      "G",
      transcription("L4-A2", {
        approach: "sin(35°) = a/8",
        intermediate_values: [{ label: "sin 35°", value: 0.5736 }],
        final_answers: [answer("a", 4.95, "cm")],
      }),
    );
    expect(result).toMatchObject({ status: "incorrect", matched_misconceptions: ["F13"] });
  });

  it("forgotten eye height in L6-A1 with right intermediate values gives F13", () => {
    const result = verify(
      getTask("L6-A1"),
      { d: 50, alpha: 32, eye: 1.6 },
      "M",
      transcription("L6-A1", {
        intermediate_values: [{ label: "tan 32°", value: 0.6249 }, { label: "x", value: 31.24 }],
        final_answers: [answer("h", 31.24, "m")],
      }),
    );
    expect(result.matched_misconceptions).toEqual(["F13"]);
  });

  it("needs intermediate values that fit the model solution", () => {
    const noIntermediates = verify(L4A2, L4A2_PARAMS, "G", transcription("L4-A2", { final_answers: [answer("a", 4.95, "cm")] }));
    expect(noIntermediates.matched_misconceptions).toEqual([]);
    const wrongIntermediate = verify(
      L4A2,
      L4A2_PARAMS,
      "G",
      transcription("L4-A2", {
        intermediate_values: [{ label: "sin 35°", value: 0.62 }],
        final_answers: [answer("a", 4.95, "cm")],
      }),
    );
    expect(wrongIntermediate.matched_misconceptions).toEqual([]);
  });
});

describe("not_found and missing answers", () => {
  it("found = false gives not_found", () => {
    const result = verify(L4A2, L4A2_PARAMS, "M", transcription("L4-A2", { found: false }));
    expect(result).toMatchObject({ status: "not_found", matched_misconceptions: [] });
  });

  it("a missing value is incorrect", () => {
    const result = verify(L4A2, L4A2_PARAMS, "M", transcription("L4-A2", { final_answers: [answer("a", 4.59, "cm")] }));
    expect(result.status).toBe("incorrect");
    expect(result.evidence.some((e) => e.quantity === "b" && e.received === null)).toBe(true);
  });

  it("an illegible value (null) is incorrect", () => {
    const result = verify(L4A2, L4A2_PARAMS, "G", transcription("L4-A2", { final_answers: [answer("a", null, "cm")] }));
    expect(result.status).toBe("incorrect");
  });

  it("rejects a transcription of another task", () => {
    expect(() => verify(L4A2, L4A2_PARAMS, "G", transcription("L4-A3"))).toThrow();
  });
});

describe("rounding variants and quantity names", () => {
  it("accepts 0.7 for sin 45° (1.005 % off, but correctly rounded)", () => {
    const result = verify(
      getTask("L3-A1"),
      {},
      "M",
      transcription("L3-A1", {
        final_answers: [answer("sin 30°", 0.5, null), answer("tan 45°", 1, null), answer("cos 60°", 0.5, null), answer("sin 45°", 0.7, null)],
      }),
    );
    expect(result).toMatchObject({ status: "correct", matched_misconceptions: [] });
  });

  it("normalises quantity names", () => {
    expect(normalizeQuantity("α")).toBe("alpha");
    expect(normalizeQuantity("a₂")).toBe("a2");
    expect(normalizeQuantity("sin 30°")).toBe("sin30");
  });

  it("uses the only answer when one quantity is sought", () => {
    const result = verify(L4A2, L4A2_PARAMS, "G", transcription("L4-A2", { final_answers: [answer("BC", 4.59, "cm")] }));
    expect(result.status).toBe("correct");
  });
});

describe("L7-A1: step checklist", () => {
  const task = getTask("L7-A1");
  const complete = [
    "a² + b² = c²   | : c²",
    "a²/c² + b²/c² = 1",
    "(a/c)² + (b/c)² = 1",
    "sin α = a/c, cos α = b/c",
    "sin²α + cos²α = 1",
  ].join("\n");

  it("all steps present is correct", () => {
    const result = verify(task, {}, "E", transcription("L7-A1", { raw_text: complete }));
    expect(result).toMatchObject({ status: "correct", matched_misconceptions: [] });
    expect(result.evidence.filter((e) => e.detail === "step present")).toHaveLength(4);
  });

  it("accepts other spellings (^2, alpha, (sin α)²)", () => {
    const text = "c^2 = a^2 + b^2\ndurch c^2 teilen\n(a/c)^2 + (b/c)^2 = 1\n(sin alpha)^2 + (cos alpha)^2 = 1";
    expect(verify(task, {}, "E", transcription("L7-A1", { raw_text: text })).status).toBe("correct");
  });

  it("some steps present is partially_correct", () => {
    const result = verify(task, {}, "E", transcription("L7-A1", { raw_text: "a² + b² = c²\nsin²α + cos²α = 1" }));
    expect(result.status).toBe("partially_correct");
    expect(result.evidence.filter((e) => e.detail === "step missing").map((e) => e.step)).toEqual([
      "divide_by_c_squared",
      "ratios_squared",
    ]);
  });

  it("no step present is incorrect", () => {
    expect(verify(task, {}, "E", transcription("L7-A1", { raw_text: "keine Ahnung" })).status).toBe("incorrect");
  });

  it("a missing sketch gives F11", () => {
    const result = verify(task, {}, "E", transcription("L7-A1", { raw_text: complete, sketch_present: false }));
    expect(result).toMatchObject({ status: "partially_correct", matched_misconceptions: ["F11"] });
  });
});
