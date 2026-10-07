import { expect, test, type Page } from "@playwright/test";

function trackForeignRequests(page: Page, origin: string): string[] {
  const foreign: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith("http") && url.origin !== origin) foreign.push(request.url());
  });
  return foreign;
}

test("landing page lists the classes and loads nothing from third parties", async ({ page, baseURL }) => {
  const foreign = trackForeignRequests(page, new URL(baseURL!).origin);
  const response = await page.goto("/");
  expect(response?.headers()["content-security-policy"]).toContain("default-src 'self'");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Denken auf Papier");
  await expect(page.getByRole("link", { name: /Zur Klasse 10/ })).toHaveAttribute("href", "/klasse10");
  await expect(page.getByRole("link", { name: /Zur Klasse 7/ })).toHaveAttribute("href", "/klasse7");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  expect(foreign).toEqual([]);
});

test("joins grade 10 with a group code, sees modules, no third-party requests", async ({ page, context, baseURL }) => {
  const foreign = trackForeignRequests(page, new URL(baseURL!).origin);

  const response = await page.goto("/klasse10");
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  await expect(page.getByRole("heading", { name: /Trigonometrie/ })).toBeVisible();

  await page.getByLabel("Dein Code").fill("e2em athe");
  await page.getByRole("button", { name: "Los geht's" }).click();
  await expect(page).toHaveURL(/\/klasse10\/willkommen$/);
  await expect(page.getByText(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/)).toBeVisible();

  await page.getByRole("link", { name: "Weiter" }).click();
  await expect(page).toHaveURL(/\/klasse10$/);
  await expect(page.getByRole("link", { name: /Trigonometrie-Einstieg/ })).toBeVisible();
  await expect(page.getByText("Schreibwerkstatt")).toHaveCount(0);

  const cookies = await context.cookies();
  expect(cookies.map((c) => c.name)).toEqual(["dr_session"]);
  expect(cookies[0]!.httpOnly).toBe(true);

  await page.getByRole("link", { name: /Trigonometrie-Einstieg/ }).click();
  await expect(page.getByRole("heading", { name: "Trigonometrie-Einstieg" })).toBeVisible();

  // Another class page sends a logged-in learner back to their own class.
  await page.goto("/klasse7");
  await expect(page).toHaveURL(/\/klasse10$/);

  await page.goto("/datenschutz");
  await expect(page.getByRole("heading", { name: "Datenschutz" })).toBeVisible();

  await page.goto("/klasse10");
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page.getByLabel("Dein Code")).toBeVisible();
  expect(await context.cookies()).toEqual([]);

  expect(foreign).toEqual([]);
});

test("a grade 7 code typed on the grade 10 page leads to grade 7", async ({ page }) => {
  await page.goto("/klasse10");
  await page.getByLabel("Dein Code").fill("E2ED-EUTS");
  await page.getByRole("button", { name: "Los geht's" }).click();
  await expect(page).toHaveURL(/\/klasse7\/willkommen$/);
});

test("explains a wrong code and normalises slugs", async ({ page }) => {
  await page.goto("/klasse10");
  await page.getByLabel("Dein Code").fill("ZZZZ-ZZZZ");
  await page.getByRole("button", { name: "Los geht's" }).click();
  await expect(page.locator("#code-fehler")).toContainText("Diesen Code kennen wir nicht");
  await page.goto("/klasse07");
  await expect(page).toHaveURL(/\/klasse7$/);
  expect((await page.goto("/klasse8"))?.status()).toBe(404);
});
