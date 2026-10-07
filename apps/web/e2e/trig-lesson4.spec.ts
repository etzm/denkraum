import { expect, test, type Page } from "@playwright/test";

// Lesson 4 of the trigonometry module end to end, with LLM_PROVIDER=mock (playwright.config.ts):
// the mock transcription reads every task correctly, the mock feedback phrases the catalog hints.

test.describe.configure({ timeout: 120_000 });

const MODULE = "/klasse10/m/mathematik-trigonometrie";

async function join(page: Page) {
  await page.goto("/klasse10");
  await page.getByLabel("Dein Code").fill("E2EM-ATHE");
  await page.getByRole("button", { name: "Los geht's" }).click();
  await expect(page).toHaveURL(/willkommen$/);
}

async function chooseLevelM(page: Page) {
  await page.goto(MODULE);
  await expect(page.getByRole("heading", { name: "Trigonometrie-Einstieg" })).toBeVisible();
  await page.getByRole("button", { name: /^Niveau M/ }).click();
  await expect(page.getByText("Du arbeitest auf Niveau M.")).toBeVisible();
}

async function openLesson(page: Page) {
  await page.getByRole("link", { name: /Lektion 4: Seitenlängen berechnen/ }).click();
  await expect(page.getByRole("heading", { name: "Seitenlängen berechnen" })).toBeVisible();
}

async function openPractice(page: Page) {
  await page.getByRole("link", { name: "Zu den Lückenaufgaben" }).click();
  await expect(page.getByRole("heading", { name: "Lückenaufgaben" })).toBeVisible();
}

/** Faded task 1 (L4-A3, M): c = 10 cm, β = 50°, b = c · sin β ≈ 7,66 cm. */
async function answerFaded1(page: Page, value: string) {
  const card = page.getByRole("region", { name: "Lückenaufgabe 1" });
  await card.getByRole("radio", { name: "b = c · sin β" }).check();
  await card.getByLabel("Lückenaufgabe 1: Ergebnis für b").fill(value);
  await card.getByRole("button", { name: "Prüfen" }).click();
}

/** Faded task 2 (L4-A4, M): b = 6 cm, α = 35°, a = b · tan α ≈ 4,20 cm. */
async function answerFaded2(page: Page, value: string) {
  const card = page.getByRole("region", { name: "Lückenaufgabe 2" });
  await card.getByRole("radio", { name: "a = b · tan α" }).check();
  await card.getByLabel("Lückenaufgabe 2: Ergebnis für a").fill(value);
  await card.getByRole("button", { name: "Prüfen" }).click();
}

/** A synthetic photo, drawn in the browser: no real handwriting in the repository. */
async function syntheticJpeg(page: Page, code: string): Promise<Buffer> {
  const bytes = await page.evaluate(async (sheetCode) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 900;
    const g = canvas.getContext("2d")!;
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.strokeStyle = "#1b2740";
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(100, 700);
    g.lineTo(600, 700);
    g.lineTo(600, 300);
    g.closePath();
    g.stroke();
    g.fillStyle = "#1b2740";
    g.font = "40px sans-serif";
    g.fillText(`Blatt ${sheetCode}, Aufgabe 1`, 80, 120);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.8));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  }, code);
  return Buffer.from(bytes);
}

/** From the worksheet: photo, transcription, confirm screen. */
async function uploadPhoto(page: Page) {
  const code = (await page.getByTestId("blatt-code").textContent())!.trim();
  expect(code).toMatch(/^[A-Z2-9]{4}$/);
  await page.getByRole("link", { name: "Fertig? Foto hochladen" }).click();
  await page.getByTestId("photo-input").setInputFiles({ name: "blatt.jpg", mimeType: "image/jpeg", buffer: await syntheticJpeg(page, code) });
  await expect(page.getByAltText("Vorschau Seite 1")).toBeVisible();
  await page.getByRole("button", { name: "Foto hochladen" }).click();
  // The page reads the photo by itself ("Ich lese deine Lösung …") and then asks for confirmation.
  await expect(page.getByRole("heading", { name: "Habe ich dich richtig gelesen?" })).toBeVisible();
  await expect(page.getByAltText("Dein Foto, Seite 1")).toBeVisible();
}

test("lesson 4: level, faded tasks, worksheet, photo, confirmation, AI feedback, lesson passed", async ({ page }) => {
  await join(page);
  await chooseLevelM(page);
  await openLesson(page);

  // Tapping β names the sides again, relative to β.
  await expect(page.getByText("Blick von α: a ist die Gegenkathete, b ist die Ankathete, c ist die Hypotenuse.")).toBeVisible();
  await page.getByRole("button", { name: "Winkel β" }).click();
  await expect(page.getByText("Blick von β: a ist die Ankathete, b ist die Gegenkathete, c ist die Hypotenuse.")).toBeVisible();

  // Calculator check: RAD is recognised, DEG passes.
  const calculator = page.getByLabel("Was zeigt dein Rechner für sin 30°?");
  await calculator.fill("-0,988");
  await page.getByRole("button", { name: "Prüfen" }).click();
  await expect(page.getByText(/Er steht auf RAD/)).toBeVisible();
  await page.getByLabel("Was zeigt dein Rechner für sin 30°?").fill("0,5");
  await page.getByRole("button", { name: "Prüfen" }).click();
  await expect(page.getByText("Richtig: sin 30° = 0,5. Dein Rechner steht auf DEG.")).toBeVisible();

  // Worked example, step by step.
  await page.getByRole("button", { name: "Alle Schritte zeigen" }).click();
  await expect(page.getByText(/^Antwortsatz: Die Seite a ist ungefähr 3,21 cm lang/)).toBeVisible();

  await openPractice(page);
  await answerFaded1(page, "7,66");
  await expect(page.getByRole("region", { name: "Lückenaufgabe 1" }).getByText("richtig", { exact: true })).toBeVisible();
  await answerFaded2(page, "4,2");
  await expect(page.getByRole("region", { name: "Lückenaufgabe 2" }).getByText("richtig", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Arbeitsblatt öffnen" }).click();
  await expect(page.getByRole("heading", { name: "Dein Arbeitsblatt" })).toBeVisible();
  await expect(page.getByText("Schreib den Blatt-Code und die Aufgabennummer an jede Lösung.")).toBeVisible();
  for (const n of [1, 2, 3, 4]) await expect(page.getByRole("heading", { name: `Aufgabe ${n}` })).toBeVisible();

  // Phone width: no horizontal scrolling.
  await page.setViewportSize({ width: 375, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await page.setViewportSize({ width: 810, height: 1080 });

  await uploadPhoto(page);
  // The mock read the right values; they are prefilled and editable.
  await expect(page.getByLabel("Aufgabe 1: Wert für a")).toHaveValue(/^\d+,\d+$/);
  await page.getByRole("button", { name: "Stimmt so, jetzt prüfen" }).click();

  await expect(page.getByRole("heading", { name: "Deine Rückmeldung" })).toBeVisible();
  for (const n of [1, 2, 3, 4]) {
    const card = page.getByRole("article", { name: `Aufgabe ${n}` });
    await expect(card.getByText("richtig", { exact: true })).toBeVisible();
    await expect(card.getByText("KI-Rückmeldung")).toBeVisible();
    await expect(card.getByText("Diese Rückmeldung hat eine KI formuliert. Ob deine Lösung stimmt, hat das Programm geprüft.")).toBeVisible();
  }
  await expect(page.getByText("Lektion 4 geschafft!")).toBeVisible();
  await expect(page.getByRole("button", { name: "Nochmal mit neuen Zahlen" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Lösungsweg ansehen" })).toHaveCount(0);

  await page.getByRole("button", { name: "Fotos jetzt löschen" }).click();
  await expect(page.getByText("Die Fotos zu diesem Blatt sind gelöscht.")).toBeVisible();

  await page.goto(MODULE);
  await expect(page.getByText("geschafft", { exact: true })).toBeVisible();
});

test("lesson 4: a wrong value gets a misconception hint, never the result; the solution opens after two failed attempts", async ({ page }) => {
  await join(page);
  await chooseLevelM(page);
  await openLesson(page);
  await openPractice(page);

  // Three wrong attempts at faded task 1 (cos instead of sin): hints, then the solution "mit Hilfe".
  await answerFaded1(page, "6,43");
  const faded1 = page.getByRole("region", { name: "Lückenaufgabe 1" });
  await expect(faded1.getByText("Noch nicht richtig.")).toBeVisible();
  await expect(faded1.getByText(/Tipp: Welche Seite liegt dem Winkel gegenüber\?/)).toBeVisible();
  await expect(faded1.getByText("Fehlversuche: 1 von 3.", { exact: false })).toBeVisible();
  await answerFaded1(page, "6,43");
  await expect(faded1.getByText("Fehlversuche: 2 von 3.", { exact: false })).toBeVisible();
  await answerFaded1(page, "6,43");
  await expect(faded1.getByText("mit Hilfe")).toBeVisible();
  await expect(faded1.getByText("Hier ist der vollständige Lösungsweg.", { exact: false })).toBeVisible();
  await answerFaded2(page, "4,20");

  await page.getByRole("button", { name: "Arbeitsblatt öffnen" }).click();
  await expect(page.getByText("Die Lückenaufgaben hast du mit Hilfe gelöst.")).toBeVisible();
  await uploadPhoto(page);

  const field = page.getByLabel("Aufgabe 1: Wert für a");
  const right = await field.inputValue();
  expect(right).toMatch(/^\d+,\d+$/);
  await field.fill("-3,43");
  await page.getByRole("button", { name: "Stimmt so, jetzt prüfen" }).click();

  const card = page.getByRole("article", { name: "Aufgabe 1" });
  await expect(card.getByText("nochmal", { exact: true })).toBeVisible();
  await expect(card.getByText("Erkannt: Taschenrechner nicht auf DEG")).toBeVisible();
  await expect(card.getByText(/Stell deinen Rechner auf DEG/)).toBeVisible();
  await expect(card.getByText("KI-Rückmeldung")).toBeVisible();
  const notTheResult = new RegExp(`(^|[^0-9,])${right.replace(",", "[,.]")}([^0-9]|$)`);
  await expect(card).not.toContainText(notTheResult);
  await expect(card.getByRole("button", { name: "Lösungsweg ansehen" })).toHaveCount(0);

  // Second attempt with new numbers, wrong again: now the solution may be opened.
  await page.getByRole("button", { name: "Nochmal mit neuen Zahlen" }).click();
  await expect(page.getByRole("heading", { name: "Dein Arbeitsblatt" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Aufgabe 1" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Aufgabe 2" })).toHaveCount(0);
  await uploadPhoto(page);
  await page.getByLabel("Aufgabe 1: Wert für a").fill("-3,43");
  await page.getByRole("button", { name: "Stimmt so, jetzt prüfen" }).click();

  const second = page.getByRole("article", { name: "Aufgabe 1" });
  await expect(second.getByText("nochmal", { exact: true })).toBeVisible();
  await second.getByRole("button", { name: "Lösungsweg ansehen" }).click();
  await expect(page.getByRole("heading", { name: "Lösungsweg zu Aufgabe 1" })).toBeVisible();
  await expect(page.getByText(/a = .* · sin .*≈/)).toBeVisible();
});
