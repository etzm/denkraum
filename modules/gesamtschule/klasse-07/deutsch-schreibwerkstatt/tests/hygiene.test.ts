import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MODULE_ROOT } from "./fixtures.ts";

function moduleFiles(dir: URL): URL[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules") return [];
    if (entry.isDirectory()) return moduleFiles(new URL(`${entry.name}/`, dir));
    return [new URL(entry.name, dir)];
  });
}

describe("module hygiene", () => {
  it("contains no em dash or en dash in any file", () => {
    const dashes = /[\u2013\u2014]/;
    const offenders = moduleFiles(MODULE_ROOT).filter((file) => dashes.test(readFileSync(file, "utf8")));
    expect(offenders.map((f) => f.pathname)).toEqual([]);
  });
});
