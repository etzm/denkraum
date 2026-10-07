import { expect, test, type Page } from "@playwright/test";

// Schreibwerkstatt phase B1: mission m-04-01 with typed plan and text, against the mock model
// (LLM_PROVIDER=mock, fixtures in the module). Unapproved content is switched on for the test
// server (DENKRAUM_SHOW_UNAPPROVED=true). All texts are synthetic.

/** Marker word of the module's mock fixtures: the text review sets `inappropriate`. */
const INAPPROPRIATE_MARKER = "TESTMARKER-UNGEEIGNET";
const AI_LABEL = "Diese Rückmeldung hat eine KI formuliert.";

const TEXT = [
  "An unserer Schule wird gerade diskutiert, ob die Mittagspause länger werden soll. Ich bin der Meinung, dass wir eine längere Mittagspause brauchen.",
  "Zunächst können wir in einer längeren Pause in Ruhe essen. Im Moment müssen viele schnell essen, weil die Schlange in der Mensa lang ist. Gestern hatte ich zum Beispiel nur zehn Minuten für mein Essen.",
  "Außerdem bleibt mehr Zeit für Freunde. Wer zusammen spielt, versteht sich besser. In unserer Klasse wurde letzte Woche ein Streit in der Pause geklärt.",
  "Vor allem aber können wir uns am Nachmittag besser konzentrieren. Wer sich in der Pause bewegt hat, ist danach wacher. Nach einer kurzen Pause sind zum Beispiel viele im Mathematikunterricht müde.",
  "Aus diesen Gründen bitte ich die Schulkonferenz, die Mittagspause zu verlängern.",
].join("\n");

type Plan = {
  thema?: string;
  standpunkt?: string;
  argumente?: { behauptung?: string; begruendung?: string; beispiel?: string }[];
  reihenfolge?: string;
  schluss?: string;
};

const GOOD_PLAN: Plan = {
  thema: "Längere Mittagspause",
  standpunkt: "Ich bin für eine längere Mittagspause.",
  argumente: [
    { behauptung: "mehr Zeit zum Essen", begruendung: "Schlange in der Mensa", beispiel: "gestern nur zehn Minuten" },
    { behauptung: "Zeit für Freunde", begruendung: "Streit wird geklärt", beispiel: "Streit letzte Woche" },
    { behauptung: "besser konzentrieren", begruendung: "Bewegung macht wach", beispiel: "müde in Mathe" },
  ],
  reihenfolge: "1, 2, 3",
  schluss: "Bitte an die Schulkonferenz",
};

async function openSchreibwerkstatt(page: Page) {
  await page.goto("/klasse7");
  await page.getByLabel("Dein Code").fill("E2ED-EUTS");
  await page.getByRole("button", { name: "Los geht's" }).click();
  await expect(page).toHaveURL(/\/klasse7\/willkommen$/);
  await page.getByRole("link", { name: "Weiter" }).click();
  await page.getByRole("link", { name: /Schreibwerkstatt/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Schreibwerkstatt" })).toBeVisible();
}

async function startMission(page: Page) {
  await expect(page.getByRole("heading", { name: "Brauchen wir eine längere Mittagspause?" })).toBeVisible();
  await page.getByRole("button", { name: "Mission starten" }).click();
  await expect(page).toHaveURL(/\/klasse7\/m\/deutsch-schreibwerkstatt\/lauf\/[\w-]+$/);
}

async function fillPlan(page: Page, plan: Plan) {
  if (plan.thema !== undefined) await page.getByLabel("Thema", { exact: true }).fill(plan.thema);
  if (plan.standpunkt !== undefined) await page.getByLabel("Mein Standpunkt", { exact: true }).fill(plan.standpunkt);
  for (const [i, a] of (plan.argumente ?? []).entries()) {
    const box = page.getByRole("group", { name: `Argument ${i + 1}` });
    if (a.behauptung !== undefined) await box.getByLabel("Behauptung", { exact: true }).fill(a.behauptung);
    if (a.begruendung !== undefined) await box.getByLabel("Begründung", { exact: true }).fill(a.begruendung);
    if (a.beispiel !== undefined) await box.getByLabel("Beispiel", { exact: true }).fill(a.beispiel);
  }
  if (plan.reihenfolge !== undefined) await page.getByLabel("Reihenfolge", { exact: true }).fill(plan.reihenfolge);
  if (plan.schluss !== undefined) await page.getByLabel("Schluss", { exact: true }).fill(plan.schluss);
  await page.getByRole("button", { name: "Plan abschicken" }).click();
}

async function planAndStartWriting(page: Page) {
  await page.getByRole("button", { name: "Ich habe den Auftrag verstanden" }).click();
  await fillPlan(page, GOOD_PLAN);
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await page.getByRole("button", { name: "Ich fange an zu schreiben" }).click();
}

async function writeText(page: Page, text: string) {
  await page.getByLabel("Dein Text").fill(text);
  await page.getByRole("button", { name: "Text abschicken" }).click();
}

test.describe("Schreibwerkstatt m-04-01 (typed)", () => {
  test.setTimeout(90_000);

  test("plans, writes, gets AI feedback with quotes, revises and completes", async ({ page }) => {
    await openSchreibwerkstatt(page);
    await startMission(page);

    // Briefing: task, addressee, operator, success checklist.
    const task = page.getByRole("region", { name: "Dein Auftrag" });
    await expect(task).toContainText("Die Schulkonferenz berät");
    await expect(task).toContainText("Schulkonferenz");
    await expect(task).toContainText("Nimm Stellung");
    await expect(page.getByRole("region", { name: "Daran erkennst du einen gelungenen Text" })).toContainText(
      "Meine Einleitung nennt das Thema und meinen Standpunkt.",
    );
    await page.getByRole("button", { name: "Ich habe den Auftrag verstanden" }).click();

    // Planning form with the boxes of the planning sheet, then P2 feedback.
    await expect(page.getByRole("heading", { name: "Plane deinen Text" })).toBeVisible();
    await fillPlan(page, GOOD_PLAN);
    const planFeedback = page.getByRole("region", { name: "Rückmeldung zu deinem Plan" });
    await expect(planFeedback.getByText(AI_LABEL)).toBeVisible();
    await expect(planFeedback).toContainText("So habe ich deinen Plan verstanden:");
    await expect(planFeedback.getByRole("list", { name: "Ampel für deinen Plan" }).getByRole("listitem")).toHaveCount(5);
    await expect(planFeedback).toContainText("Eine Frage an dich:");
    await expect(page.getByRole("region", { name: "Prüfung durch die App" })).toContainText("Dein Plan ist bereit zum Schreiben.");
    await page.getByLabel("Deine Antwort auf die Frage (freiwillig)").fill("Das stärkste Argument kommt zuletzt.");
    await page.getByRole("button", { name: "Weiter", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Dein Plan ist freigegeben" })).toBeVisible();
    await page.getByRole("button", { name: "Ich fange an zu schreiben" }).click();

    // Too short: code sends the text back (80 words).
    await writeText(page, "Ich finde, die Mittagspause sollte länger sein.");
    await expect(page.getByRole("alert").filter({ hasText: "Dein Text hat" })).toContainText("mindestens 80 Wörter");
    await writeText(page, TEXT);

    // Self check.
    await expect(page.getByRole("heading", { name: "Prüf deinen Text selbst" })).toBeVisible();
    await page.getByLabel("Meine Einleitung nennt das Thema und meinen Standpunkt.").check();
    await page.getByLabel("Jedes Argument hat Behauptung, Begründung und Beispiel.").check();
    await page.getByRole("button", { name: "Selbstkontrolle abschicken" }).click();

    // P4 feedback: labelled as AI, Textlupe with exact quotes, stars without spelling (D-021).
    const textFeedback = page.getByRole("region", { name: "Rückmeldung zu deinem Text" });
    await expect(textFeedback.getByText(AI_LABEL)).toBeVisible();
    await expect(textFeedback.locator('mark[data-part="these"]')).toContainText("Ich bin der Meinung, dass wir eine längere Mittagspause brauchen.");
    await expect(textFeedback.locator('mark[data-part="beispiel"]').first()).toContainText("Gestern hatte ich zum Beispiel nur zehn Minuten");
    expect(await textFeedback.locator("mark").count()).toBeGreaterThanOrEqual(6);
    await expect(textFeedback).toContainText("Zwei Stärken");
    const stars = page.getByRole("region", { name: "Deine Sterne" });
    await expect(stars).toContainText("kommt später");
    await expect(stars).toContainText("von 9 Sternen");

    // Resumable after reload.
    await page.reload();
    await expect(page.getByRole("region", { name: "Rückmeldung zu deinem Text" })).toBeVisible();
    await page.getByRole("button", { name: "Zur Überarbeitung" }).click();

    // Revision task (AI), typed, checked by P5.
    const revisionTask = page.getByRole("region", { name: "Deine Überarbeitungsaufgabe" });
    await expect(revisionTask.getByText(AI_LABEL)).toBeVisible();
    await expect(revisionTask).toContainText("Aus diesen Gründen bitte ich die Schulkonferenz");
    await expect(revisionTask).toContainText("Hilfskarte HK-06");
    await page
      .getByLabel(/Deine überarbeitete Stelle/)
      .fill("Aus diesen Gründen bin ich für eine längere Mittagspause. Liebe Schulkonferenz, bitte stimmen Sie dafür.");
    await page.getByRole("button", { name: "Überarbeitung abschicken" }).click();

    await expect(page.getByRole("heading", { name: "Mission geschafft!" })).toBeVisible();
    await expect(page.getByText("+120 XP")).toBeVisible();
    await expect(page.getByRole("region", { name: "Rückmeldung zu deiner Überarbeitung" }).getByText(AI_LABEL)).toBeVisible();

    await page.getByRole("link", { name: "Zurück zur Schreibwerkstatt" }).click();
    await expect(page.getByText("Du hast diese Mission schon geschafft.")).toBeVisible();
  });

  test("sends a plan without stance back for revision until the code check passes", async ({ page }) => {
    await openSchreibwerkstatt(page);
    await startMission(page);
    await page.getByRole("button", { name: "Ich habe den Auftrag verstanden" }).click();

    await fillPlan(page, { thema: "Mittagspause", argumente: [{ behauptung: "mehr Zeit zum Essen", begruendung: "Schlange in der Mensa" }] });
    await expect(page.getByRole("region", { name: "Rückmeldung zu deinem Plan" }).getByText(AI_LABEL)).toBeVisible();
    await expect(page.getByRole("region", { name: "Prüfung durch die App" })).toContainText("Ergänze deinen Plan noch");
    await page.getByRole("button", { name: "Weiter", exact: true }).click();

    const gaps = page.getByRole("region", { name: "Dein Plan braucht noch etwas" });
    await expect(gaps).toContainText("Überarbeitungsrunde 1 von 2");
    await expect(gaps).toContainText("Schreib deinen Standpunkt in den Kasten MEIN STANDPUNKT.");
    await expect(gaps).toContainText("mindestens zwei Argumente");
    // The form keeps what was planned before.
    await expect(page.getByLabel("Thema", { exact: true })).toHaveValue("Mittagspause");

    await fillPlan(page, {
      standpunkt: "Ich bin für eine längere Mittagspause.",
      argumente: [{}, { behauptung: "besser konzentrieren", begruendung: "Bewegung macht wach" }],
    });
    await expect(page.getByRole("region", { name: "Prüfung durch die App" })).toContainText("Dein Plan ist bereit zum Schreiben.");
    await page.getByRole("button", { name: "Weiter", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Dein Plan ist freigegeben" })).toBeVisible();
  });

  test("holds an inappropriate text for an adult and shows no feedback", async ({ page }) => {
    await openSchreibwerkstatt(page);
    await startMission(page);
    await planAndStartWriting(page);
    await writeText(page, `${TEXT}\n${INAPPROPRIATE_MARKER}`);
    await page.getByRole("button", { name: "Selbstkontrolle abschicken" }).click();

    await expect(page.getByRole("heading", { name: "Danke für deinen Text" })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Ein Erwachsener schaut sich deinen Text an");
    await expect(page.getByText(AI_LABEL)).toHaveCount(0);
    await expect(page.locator("mark")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Zur Überarbeitung" })).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Danke für deinen Text" })).toBeVisible();
    await page.getByRole("link", { name: "Zurück zur Schreibwerkstatt" }).click();
    await expect(page.getByRole("link", { name: "Mission fortsetzen" })).toBeVisible();
  });
});
