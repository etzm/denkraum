import { describe, expect, it } from "vitest";
import { fitWithin, rotatedSize } from "./image.ts";

describe("image sizing", () => {
  it("scales the longer side down and never up", () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032, 2000)).toEqual({ width: 1500, height: 2000 });
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it("swaps width and height for odd quarter turns", () => {
    expect(rotatedSize(1600, 1200, 1)).toEqual({ width: 1200, height: 1600 });
    expect(rotatedSize(1600, 1200, 2)).toEqual({ width: 1600, height: 1200 });
  });
});
