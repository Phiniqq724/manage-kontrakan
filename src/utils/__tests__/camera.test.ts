/// <reference types="jest" />

import { pickPictureSize } from "@/utils/camera";

describe("pickPictureSize", () => {
  it("picks the smallest 4:3 size that still covers the target", () => {
    expect(
      pickPictureSize(["4000x3000", "1920x1080", "1440x1080", "640x480"]),
    ).toBe("1440x1080");
  });

  it("falls back to the smallest fitting size when no 4:3 one fits", () => {
    expect(pickPictureSize(["3840x2160", "1920x1080", "800x600"])).toBe(
      "1920x1080",
    );
  });

  it("returns undefined when nothing parses or fits", () => {
    expect(pickPictureSize(["Photo", "High", "640x480"])).toBeUndefined();
    expect(pickPictureSize([])).toBeUndefined();
  });
});
