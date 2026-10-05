import { expect, test } from "@playwright/test";

test("joins with a group code, sees modules, no third-party requests", async ({ page, context, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const foreign: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith("http") && url.origin !== origin) foreign.push(request.url());
  });

  const response = await page.goto("/");
  expect(response?.headers()["content-security-policy"]).toContain("default-src 'self'");
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  await expect(page.getByRole("heading", { name: "Denkraum" })).toBeVisible();

  await page.getByLabel("Dein Code").fill("e2em athe");
  await page.getByRole("button", { name: "Los geht's" }).click();
  await expect(page).toHaveURL(/\/willkommen$/);
  await expect(page.getByText(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/)).toBeVisible();

  await page.getByRole("link", { name: "Weiter" }).click();
  await expect(page.getByRole("link", { name: /Trigonometrie-Einstieg/ })).toBeVisible();
  await expect(page.getByText("Schreibwerkstatt")).toHaveCount(0);

  const cookies = await context.cookies();
  expect(cookies.map((c) => c.name)).toEqual(["dr_session"]);
  expect(cookies[0]!.httpOnly).toBe(true);

  await page.getByRole("link", { name: /Trigonometrie-Einstieg/ }).click();
  await expect(page.getByRole("heading", { name: "Trigonometrie-Einstieg" })).toBeVisible();

  await page.goto("/datenschutz");
  await expect(page.getByRole("heading", { name: "Datenschutz" })).toBeVisible();

  await page.goto("/m");
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await context.cookies()).toEqual([]);

  expect(foreign).toEqual([]);
});

test("explains a wrong code", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Dein Code").fill("ZZZZ-ZZZZ");
  await page.getByRole("button", { name: "Los geht's" }).click();
  await expect(page.locator("#code-fehler")).toContainText("Diesen Code kennen wir nicht");
});
