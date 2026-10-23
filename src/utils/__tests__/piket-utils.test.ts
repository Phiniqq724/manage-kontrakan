/// <reference types="jest" />

import {
  buildDateStrip,
  EXTRA_PER_DAY,
  extraBlockReason,
  filterMineDays,
  findNextMine,
  getTodayStr,
  groupByDay,
  isRequestOpen,
  isShownPiket,
  pastDays,
  relativeDay,
} from "@/utils/piket-utils";

describe("getTodayStr", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  const setLocalTime = (year: number, monthIndex: number, day: number, hour = 12, minute = 0) => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(year, monthIndex, day, hour, minute));
  };

  it("formats a mid-year date as YYYY-MM-DD", () => {
    setLocalTime(2026, 9, 15);
    expect(getTodayStr()).toBe("2026-10-15");
  });

  it("zero-pads single-digit months and days", () => {
    setLocalTime(2026, 0, 5);
    expect(getTodayStr()).toBe("2026-01-05");
  });

  it("rolls over at local midnight", () => {
    setLocalTime(2026, 9, 15, 23, 59);
    expect(getTodayStr()).toBe("2026-10-15");

    jest.setSystemTime(new Date(2026, 9, 16, 0, 0));
    expect(getTodayStr()).toBe("2026-10-16");
  });

  it("handles a year boundary", () => {
    setLocalTime(2026, 11, 31, 23, 30);
    expect(getTodayStr()).toBe("2026-12-31");

    jest.setSystemTime(new Date(2027, 0, 1, 0, 30));
    expect(getTodayStr()).toBe("2027-01-01");
  });

  it("handles a leap day", () => {
    setLocalTime(2028, 1, 29);
    expect(getTodayStr()).toBe("2028-02-29");
  });
});

const row = (day: string, assign_to: string | null, status = "pending") => ({ day, assign_to, status });

describe("buildDateStrip", () => {
  it("builds consecutive days across month and year boundaries", () => {
    expect(buildDateStrip("2026-12-30", 4)).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
  });
});

describe("groupByDay", () => {
  it("groups rows by day", () => {
    const g = groupByDay([row("2026-10-16", "a"), row("2026-10-16", "b"), row("2026-10-17", "a")]);
    expect(g["2026-10-16"]).toHaveLength(2);
    expect(g["2026-10-17"]).toHaveLength(1);
  });
});

describe("filterMineDays", () => {
  it("keeps only days where the user is assigned", () => {
    const byDay = groupByDay([row("d1", "a"), row("d1", "b"), row("d2", "b"), row("d3", "a")]);
    expect(filterMineDays(["d1", "d2", "d3", "d4"], byDay, "a")).toEqual(["d1", "d3"]);
  });
});

describe("findNextMine", () => {
  it("returns the earliest unfinished upcoming row", () => {
    const rows = [row("2026-10-20", "a"), row("2026-10-15", "a"), row("2026-10-17", "a", "done"), row("2026-10-18", "a")];
    expect(findNextMine(rows, "a", "2026-10-16")?.day).toBe("2026-10-18");
    expect(findNextMine(rows, "z", "2026-10-16")).toBeNull();
  });

  it("skips extra piket", () => {
    const rows = [
      { ...row("2026-10-16", "a", "rejected"), extra: true },
      row("2026-10-19", "a"),
    ];
    expect(findNextMine(rows, "a", "2026-10-16")?.day).toBe("2026-10-19");
  });
});

describe("extra piket", () => {
  const extra = (assignTo: string, status = "done") => ({ ...row("2026-10-16", assignTo, status), extra: true });

  it("asks you to finish your own piket first", () => {
    expect(extraBlockReason([row("2026-10-16", "a")], "a")).toMatch(/sendiri/);
    expect(extraBlockReason([row("2026-10-16", "a", "rejected")], "a")).toMatch(/sendiri/);
    expect(extraBlockReason([row("2026-10-16", "a", "done")], "a")).toBeNull();
  });

  it("caps extra piket per day, rejected ones included", () => {
    const one = [extra("a")];
    const full = Array.from({ length: EXTRA_PER_DAY }, (_, i) => extra("a", i ? "rejected" : "done"));
    expect(extraBlockReason(one, "a")).toBeNull();
    expect(extraBlockReason(full, "a")).toMatch(/tambahan/);
    expect(extraBlockReason(full, "b")).toBeNull();
  });
});

describe("isRequestOpen", () => {
  it("hides requests whose day passed or whose piket is handled", () => {
    const pending = { status: "pending" };
    expect(isRequestOpen(pending, row("2026-10-16", "a"), "2026-10-16")).toBe(true);
    expect(isRequestOpen(pending, row("2026-10-15", "a"), "2026-10-16")).toBe(false);
    expect(isRequestOpen(pending, row("2026-10-17", "a", "done"), "2026-10-16")).toBe(false);
    expect(isRequestOpen(pending, undefined, "2026-10-16")).toBe(false);
    expect(isRequestOpen({ status: "accepted" }, row("2026-10-17", "a"), "2026-10-16")).toBe(false);
  });
});

describe("relativeDay", () => {
  it("labels today, tomorrow and later", () => {
    expect(relativeDay("2026-10-16", "2026-10-16")).toBe("Hari ini");
    expect(relativeDay("2026-10-17", "2026-10-16")).toBe("Besok");
    expect(relativeDay("2026-10-20", "2026-10-16")).toBe("4 hari lagi");
  });
});

describe("pastDays", () => {
  it("lists only days before today, oldest first", () => {
    const byDay = { "2026-10-14": [1], "2026-10-16": [1], "2026-10-12": [1], "2026-10-17": [1] };
    expect(pastDays(byDay, "2026-10-16")).toEqual(["2026-10-12", "2026-10-14"]);
  });

  it("is empty when nothing happened before today", () => {
    expect(pastDays({ "2026-10-16": [1] }, "2026-10-16")).toEqual([]);
  });
});

describe("isShownPiket", () => {
  it("hides only rejected extra pikets", () => {
    expect(isShownPiket({ extra: true, status: "rejected" })).toBe(false);
    expect(isShownPiket({ extra: true, status: "done" })).toBe(true);
    expect(isShownPiket({ extra: false, status: "rejected" })).toBe(true);
  });
});
