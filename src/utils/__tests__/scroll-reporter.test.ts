/// <reference types="jest" />

/** Loads the module fresh against a given native module (null = not in the build). */
const load = (native: { modifiers?: string[] } | null) => {
  let mod!: typeof import("../../../modules/scroll-reporter");
  jest.isolateModules(() => {
    jest.doMock("expo", () => ({ requireOptionalNativeModule: () => native }));
    mod = require("../../../modules/scroll-reporter");
  });
  return mod;
};

const CURRENT_BUILD = { modifiers: ["scrollReporter", "horizontalScrollFromEnd"] };
/** A build from before the modifiers list existed: only scrollReporter. */
const OLD_BUILD = {};

describe("scrollReporter", () => {
  it("reports direction changes when the native modifier is in the build", () => {
    const onChange = jest.fn();
    const modifier = load(CURRENT_BUILD).scrollReporter(onChange);

    expect(modifier.$type).toBe("scrollReporter");
    modifier.eventListener?.({ direction: "down" });
    expect(onChange).toHaveBeenCalledWith("down");
  });

  it("passes enabled through so the page can stop scrolling while dragging", () => {
    const mod = load(CURRENT_BUILD);
    expect(mod.scrollReporter(jest.fn()).enabled).toBe(true);
    expect(mod.scrollReporter(jest.fn(), false).enabled).toBe(false);
  });

  it("still works on a build from before the modifiers list", () => {
    expect(load(OLD_BUILD).scrollReporter(jest.fn()).$type).toBe("scrollReporter");
  });

  it("falls back to plain verticalScroll when the native module is missing", () => {
    const modifier = load(null).scrollReporter(jest.fn());

    expect(modifier.$type).toBe("verticalScroll");
    expect(modifier.eventListener).toBeUndefined();
  });
});

describe("horizontalScrollFromEnd", () => {
  it("uses the native modifier when the build has it", () => {
    expect(load(CURRENT_BUILD).horizontalScrollFromEnd().$type).toBe("horizontalScrollFromEnd");
  });

  it.each([
    ["an older build", OLD_BUILD],
    ["no native module", null],
  ])("falls back to plain horizontalScroll with %s", (_label, native) => {
    expect(load(native).horizontalScrollFromEnd().$type).toBe("horizontalScroll");
  });
});
