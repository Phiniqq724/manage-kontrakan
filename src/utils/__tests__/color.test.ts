/// <reference types="jest" />

import { hueToHex, readableOn } from "@/utils/color";

describe("hueToHex", () => {
  it("maps primary hues", () => {
    expect(hueToHex(0)).toBe("#e61919");
    expect(hueToHex(120)).toBe("#19e619");
    expect(hueToHex(240)).toBe("#1919e6");
  });

  it("wraps out-of-range hues", () => {
    expect(hueToHex(360)).toBe(hueToHex(0));
    expect(hueToHex(-120)).toBe(hueToHex(240));
  });

  it("always returns a valid hex colour", () => {
    for (let h = 0; h < 360; h += 7) expect(hueToHex(h)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("readableOn", () => {
  it("uses dark ink on light colours like Google yellow", () => {
    expect(readableOn("#FBBC04")).toBe("#000000");
    expect(readableOn("#ffffff")).toBe("#000000");
  });

  it("uses white ink on dark colours", () => {
    expect(readableOn("#6750A4")).toBe("#ffffff");
    expect(readableOn("#000000")).toBe("#ffffff");
  });

  it("falls back to white for non-hex input", () => {
    expect(readableOn("red")).toBe("#ffffff");
  });
});
