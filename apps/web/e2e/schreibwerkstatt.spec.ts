import { expect, test, type Page } from "@playwright/test";

// Spec B, phase 1 DoD: a complete run of m-04-01 on a phone, typed, with the mock model;
// every state resumes after a reload. The seed (--e2e) provides a learner who finished
// stages 1 to 3 and passed the station before m-04-01. Synthetic text only.

test.use({ viewport: { width: 375, height: 812 } });

const TEXT = [
  "An unserer Schule wird diskutiert, ob die Mittagspause länger werden soll. Ich bin der Meinung, dass wir eine längere Mittagspause brauchen.",
  "Zunächst können wir in einer längeren Pause in Ruhe essen. Im Moment müssen viele schnell essen, weil die Schlange in der Mensa lang ist. Gestern hatte ich zum Beispiel nur zehn Minuten für mein Essen.",
  "Vor allem aber können wir uns am Nachmittag besser konzentrieren. Wer sich in der Pause bewegt hat, ist danach wacher. In unserer Klasse sind nach einer kurzen Pause viele müde.",
  "Aus diesen Gründen bitte ich die Schulkonferenz, die Mittagspause zu verlängern.",
];

async function expectStep(page: Page, title: string) {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  // Resumable: a reload shows the same step (spec 4).
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  // Mobile first: nothing wider than the phone.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
}

test("runs mission m-04-01 typed from briefing to completion", async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const foreign: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith("http") && url.origin !== origin) foreign.push(request.url());
  });

  await page.goto("/");
  await page.getByLabel("Dein Code").fill("e2ep rakt");
  await page.getByRole("button", { name: "Los geht's" }).click();
  await expect(page).toHaveURL(/\/m$/);
  await page.getByRole("link", { name: /Schreibwerkstatt/ }).click();
  await expect(page.getByRole("heading", { name: "Schreibwerkstatt" })).toBeVisible();

  const card = page.locator('[data-mission="m-04-01"]');
  await card.getByRole("button", { name: "Mission starten" }).click();

  await expectStep(page, "Dein Auftrag");
  await expect(page.getByText("Schulkonferenz").first()).toBeVisible();
  await page.getByRole("button", { name: "Ich habe den Auftrag verstanden" }).click();

  await expectStep(page, "Plane deinen Text");
  await page.locator('textarea[name="thema"]').fill("Längere Mittagspause");
  await page.locator('textarea[name="standpunkt"]').fill("Ich bin für eine längere Mittagspause.");
  await page.locator('textarea[name="a1_behauptung"]').fill("mehr Zeit zum Essen");
  await page.locator('textarea[name="a1_begruendung"]').fill("Schlange in der Mensa");
  await page.locator('textarea[name="a1_beispiel"]').fill("gestern nur 10 Minuten");
  await page.locator('textarea[name="a2_behauptung"]').fill("besser konzentrieren");
  await page.locator('textarea[name="a2_begruendung"]').fill("Bewegung macht wach");
  await page.locator('textarea[name="a2_beispiel"]').fill("nach kurzer Pause müde");
  await page.locator('textarea[name="reihenfolge"]').fill("1, 2");
  await page.locator('textarea[name="schluss"]').fill("Bitte an die Schulkonferenz");
  await page.getByRole("button", { name: "Plan abgeben" }).click();

  await expectStep(page, "Rückmeldung zu deinem Plan");
  await expect(page.getByText(/^So habe ich deinen Plan verstanden:/)).toBeVisible();
  await expect(page.getByText(/hat eine KI formuliert/)).toBeVisible();
  await page.locator('textarea[name="antwort"]').fill("Die Konzentration ist mein stärkstes Argument.");
  await page.getByRole("button", { name: "Weiter" }).click();

  await expectStep(page, "Dein Plan ist freigegeben");
  await page.getByRole("button", { name: "Ich fange an zu schreiben" }).click();

  await expectStep(page, "Schreib deinen Text");
  await page.locator('textarea[name="text"]').fill(TEXT.join("\n\n"));
  await page.getByRole("button", { name: "Text abgeben" }).click();

  await expectStep(page, "Prüf deinen Text selbst");
  await page.getByRole("checkbox").first().check();
  const thesis = page.getByRole("listitem").filter({ hasText: "Ich bin der Meinung, dass wir eine längere Mittagspause brauchen." });
  await thesis.getByRole("checkbox", { name: "These" }).check();
  await page.getByRole("button", { name: "Abschicken" }).click();

  await expectStep(page, "Rückmeldung zu deinem Text");
  await expect(page.locator("mark", { hasText: "Ich bin der Meinung, dass wir eine längere Mittagspause brauchen." })).toBeVisible();
  await expect(page.getByText("Zusammen: 8 von 12 Sternen")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Deine Überarbeitungsaufgabe" })).toBeVisible();
  await page.getByRole("button", { name: "Zur Überarbeitung" }).click();

  await expectStep(page, "Überarbeite eine Stelle");
  await page.locator('textarea[name="text"]').fill("Deshalb bitte ich die Schulkonferenz, die Mittagspause zu verlängern.");
  await page.getByRole("button", { name: "Überarbeitung abgeben" }).click();

  await expectStep(page, "Mission geschafft");
  await expect(page.getByText("+120 XP für diese Mission.", { exact: false })).toBeVisible();
  await expect(page.getByText("Vermerk: Text getippt.")).toBeVisible();

  await page.getByRole("link", { name: "Zur Übersicht" }).last().click();
  await expect(card.getByText("geschafft")).toBeVisible();
  expect(foreign).toEqual([]);
});

test("a learner of another class cannot open the Schreibwerkstatt", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Dein Code").fill("e2em athe");
  await page.getByRole("button", { name: "Los geht's" }).click();
  await expect(page).toHaveURL(/\/willkommen$/);
  const response = await page.goto("/m/deutsch-schreibwerkstatt");
  expect(response?.status()).toBe(404);
});
