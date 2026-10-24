/// <reference types="jest" />

import { hexToHsv, hsvToHex, hueToHex, readableOn } from "@/utils/color";

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

describe("hsvToHex / hexToHsv", () => {
  it("converts primaries and greys", () => {
    expect(hsvToHex({ h: 0, s: 1, v: 1 })).toBe("#ff0000");
    expect(hsvToHex({ h: 120, s: 1, v: 1 })).toBe("#00ff00");
    expect(hsvToHex({ h: 240, s: 1, v: 0.5 })).toBe("#000080");
    expect(hsvToHex({ h: 200, s: 0, v: 0.5 })).toBe("#808080");
  });

  it("round-trips a colour", () => {
    const hsv = hexToHsv("#4285F4")!;
    expect(hsvToHex(hsv)).toBe("#4285f4");
  });

  it("rejects non-hex input", () => {
    expect(hexToHsv("blue")).toBeNull();
    expect(hexToHsv("#12345")).toBeNull();
  });
});
