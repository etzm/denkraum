import { expect, test, type Page } from "@playwright/test";

function segment(marker: number, payload: number[]): number[] {
  const len = payload.length + 2;
  return [0xff, marker, len >> 8, len & 0xff, ...payload];
}
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
/** Tiny synthetic JPEG structure with an EXIF block that names a GPS position. */
const JPEG_WITH_GPS = [
  0xff, 0xd8,
  ...segment(0xe1, ascii("Exif\0\0GPSLatitude 47.99N")),
  ...segment(0xda, [1, 1, 0, 0, 63, 0]),
  0x12, 0x34, 0xff, 0xd9,
];

async function join(page: Page, code: string) {
  await page.goto("/klasse10");
  await page.getByLabel("Dein Code").fill(code);
  await page.getByRole("button", { name: "Los geht's" }).click();
  await expect(page).toHaveURL(/willkommen$/);
}

/** Runs fetch inside the page, so the browser's session cookie is used like in the real app. */
function upload(page: Page, fields: { module: string; kind: string; ref?: string; bytes: number[]; type: string }) {
  return page.evaluate(async (f) => {
    const form = new FormData();
    form.set("module", f.module);
    form.set("kind", f.kind);
    if (f.ref) form.set("ref", f.ref);
    form.append("pages", new Blob([new Uint8Array(f.bytes)], { type: f.type }), "seite-1.jpg");
    const response = await fetch("/api/uploads", { method: "POST", body: form });
    return { status: response.status, body: (await response.json()) as { uploadId?: string; error?: string } };
  }, fields);
}

function fetchPage(page: Page, url: string, method = "GET") {
  return page.evaluate(
    async ({ url, method }) => {
      const response = await fetch(url, { method });
      const bytes = Array.from(new Uint8Array(await response.arrayBuffer()));
      return { status: response.status, cacheControl: response.headers.get("cache-control"), bytes };
    },
    { url, method },
  );
}

test("photos are stored without GPS, shown only to their owner, and can be deleted", async ({ page, browser }) => {
  await join(page, "E2EM-ATHE");
  const created = await upload(page, { module: "mathematik-trigonometrie", kind: "worksheet", ref: "blatt-1", bytes: JPEG_WITH_GPS, type: "image/jpeg" });
  expect(created.status).toBe(201);
  const uploadId = created.body.uploadId!;

  const own = await fetchPage(page, `/api/uploads/${uploadId}/pages/1`);
  expect(own.status).toBe(200);
  expect(own.cacheControl).toContain("no-store");
  const body = Buffer.from(own.bytes);
  expect(body.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
  expect(body.includes(Buffer.from("GPS"))).toBe(false);

  const other = await browser.newPage();
  await join(other, "E2EM-ATHE");
  expect((await fetchPage(other, `/api/uploads/${uploadId}/pages/1`)).status).toBe(404);
  expect((await fetchPage(other, `/api/uploads/${uploadId}`, "DELETE")).status).toBe(404);
  await other.close();

  // Wrong module, wrong kind and non-JPEG data are refused.
  expect((await upload(page, { module: "deutsch-schreibwerkstatt", kind: "text", bytes: JPEG_WITH_GPS, type: "image/jpeg" })).status).toBe(404);
  expect((await upload(page, { module: "mathematik-trigonometrie", kind: "essay", bytes: JPEG_WITH_GPS, type: "image/jpeg" })).status).toBe(400);
  const png = await upload(page, { module: "mathematik-trigonometrie", kind: "worksheet", bytes: [0x89, 0x50, 0x4e, 0x47], type: "image/png" });
  expect(png.status).toBe(400);
  expect(png.body.error).toContain("kein JPEG");

  await page.goto("/klasse10/fotos");
  await expect(page.getByRole("heading", { name: "Meine Fotos" })).toBeVisible();
  await expect(page.getByAltText("Seite 1")).toHaveCount(1);
  await page.getByRole("button", { name: "Fotos jetzt löschen" }).click();
  await expect(page.getByRole("status")).toContainText("gelöscht");
  expect((await fetchPage(page, `/api/uploads/${uploadId}/pages/1`)).status).toBe(404);
});

test("uploads need a session", async ({ page }) => {
  await page.goto("/");
  const response = await upload(page, { module: "mathematik-trigonometrie", kind: "worksheet", bytes: JPEG_WITH_GPS, type: "image/jpeg" });
  expect(response.status).toBe(401);
});
