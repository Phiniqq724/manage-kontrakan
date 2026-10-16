/// <reference types="jest" />

import { pageKeyFromSegment, pagerPath, pagerRoute } from "@/utils/pager";

describe("pager naming", () => {
  it("names a navbar item's swiper route and URL", () => {
    expect(pagerRoute("members")).toBe("t-members");
    expect(pagerPath("adminKamar")).toBe("/t-adminKamar");
  });

  it("maps swiper and normal URL segments to the same page key", () => {
    expect(pageKeyFromSegment("t-members")).toBe("members");
    expect(pageKeyFromSegment("members")).toBe("members");
    expect(pageKeyFromSegment("dashboard")).toBe("dashboard");
  });
});
