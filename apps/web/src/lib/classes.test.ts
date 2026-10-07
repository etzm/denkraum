import { describe, expect, it } from "vitest";
import { canonicalSlug, classBySlug, slugForKlasse } from "./classes.ts";

describe("class slugs", () => {
  it("maps grades to slugs and back", () => {
    expect(slugForKlasse(10)).toBe("klasse10");
    expect(classBySlug("klasse10")?.fach).toBe("Mathematik");
    expect(classBySlug("klasse8")).toBeUndefined();
  });

  it("accepts leading zeros and capitals, rejects unknown grades", () => {
    expect(canonicalSlug("klasse07")).toBe("klasse7");
    expect(canonicalSlug("Klasse10")).toBe("klasse10");
    expect(canonicalSlug("klasse8")).toBeNull();
    expect(canonicalSlug("datenschutz")).toBeNull();
  });
});
