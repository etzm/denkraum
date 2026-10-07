import { defineModuleDefinition, type ModuleContext } from "@denkraum/sdk";
import { mockFeedback, mockTranscription, parseRequestInput, type FeedbackInput, type TranscribeInput } from "./domain/ai.ts";
import { OPEN_LESSONS } from "./domain/lesson.ts";
import { manifest } from "./module.ts";
import { PROMPTS } from "./prompts/index.ts";
import { ACTIONS } from "./server/actions.ts";
import { resultsOfSheet, worksheet, type Worksheet } from "./server/store.ts";
import { LessonPage } from "./ui/LessonPage.tsx";
import { PracticePage } from "./ui/PracticePage.tsx";
import { ConfirmPage, PhotoPage, ResultPage, SolutionPage, WorksheetPage } from "./ui/SheetPages.tsx";
import { StartPage } from "./ui/StartPage.tsx";

/**
 * Platform entry point of the module (docs/module-sdk.md). Routes below /klasse10/m/mathematik-trigonometrie:
 *   (start)                         level and progress
 *   lektion/4                       explanation, triangle, calculator check, worked example
 *   lektion/4/uebung                two faded tasks
 *   blatt/<id>                      worksheet with individual numbers
 *   blatt/<id>/foto                 photo upload
 *   blatt/<id>/pruefen?upload=<id>  transcription and "Habe ich dich richtig gelesen?"
 *   blatt/<id>/ergebnis             verified result with feedback
 *   blatt/<id>/loesung/<task>       full solution after the second failed attempt
 */
export const definition = defineModuleDefinition({
  manifest,
  prompts: PROMPTS,
  uploadKinds: { worksheet: { maxPages: 6 } },
  mockFixtures: {
    transcribe: (request) => mockTranscription(parseRequestInput(request.userText) as TranscribeInput),
    feedback: (request) => mockFeedback(parseRequestInput(request.userText) as FeedbackInput),
  },
  actions: ACTIONS,
  async render(ctx, path, search) {
    const [section, id, sub, extra] = path;
    if (section === undefined) return <StartPage ctx={ctx} />;
    const level = ctx.learner.niveau;

    if (section === "lektion") {
      if (!OPEN_LESSONS.includes(Number(id)) || extra !== undefined) return null;
      // Without a level, the start page asks for one first.
      if (!level) return <StartPage ctx={ctx} />;
      if (sub === undefined) return <LessonPage ctx={ctx} level={level} search={search} />;
      if (sub === "uebung") return <PracticePage ctx={ctx} level={level} />;
      return null;
    }

    if (section === "blatt") {
      const sheet = await worksheet(ctx, id);
      if (!sheet) return null;
      if (sub === undefined) return <WorksheetPage ctx={ctx} sheet={sheet} />;
      if (extra !== undefined && sub !== "loesung") return null;
      if (sub === "foto") return <PhotoPage ctx={ctx} sheet={sheet} />;
      if (sub === "pruefen") {
        const upload = search.upload ? await ctx.uploads.get(search.upload) : null;
        if (!upload || upload.ref !== sheet.id) return null;
        return <ConfirmPage ctx={ctx} sheet={sheet} upload={upload} />;
      }
      if (sub === "ergebnis") return <ResultPage ctx={ctx} sheet={sheet} />;
      if (sub === "loesung") {
        if (!extra || !(await solutionUnlocked(ctx, sheet, extra))) return null;
        return <SolutionPage ctx={ctx} sheet={sheet} taskId={extra} />;
      }
    }
    return null;
  },
});

/** The solution page exists only once its viewing has been logged (actions.ts, "loesung"). */
async function solutionUnlocked(ctx: ModuleContext, sheet: Worksheet, taskId: string): Promise<boolean> {
  const result = (await resultsOfSheet(ctx, sheet.id)).find((r) => r.taskId === taskId);
  return result?.solutionViewed === true;
}
