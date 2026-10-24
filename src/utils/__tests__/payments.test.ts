/// <reference types="jest" />

import { dueProgress, onTimeStreak, previousPeriod, recentMonths } from "@/utils/payments";

const pay = (period: string, status: string) => ({ period, status });

describe("previousPeriod", () => {
  it("steps back a month, across years", () => {
    expect(previousPeriod("2026-10")).toBe("2026-09");
    expect(previousPeriod("2026-01")).toBe("2025-12");
  });
});

describe("onTimeStreak", () => {
  it("counts settled on-time months back from now", () => {
    const p = [pay("2026-10", "on_time"), pay("2026-09", "on_time"), pay("2026-08", "late")];
    expect(onTimeStreak(p, "2026-10")).toBe(2);
  });

  it("skips the current month while it's still open", () => {
    const p = [pay("2026-10", "waiting_payment"), pay("2026-09", "on_time"), pay("2026-08", "on_time")];
    expect(onTimeStreak(p, "2026-10")).toBe(2);
    expect(onTimeStreak([pay("2026-09", "on_time")], "2026-10")).toBe(1);
  });

  it("is 0 after a late month or with no history", () => {
    expect(onTimeStreak([pay("2026-10", "late")], "2026-10")).toBe(0);
    expect(onTimeStreak([], "2026-10")).toBe(0);
  });
});

describe("recentMonths", () => {
  it("lists the last months oldest first with their status", () => {
    expect(recentMonths([pay("2026-10", "pending"), pay("2026-08", "late")], "2026-10", 3)).toEqual([
      { period: "2026-08", status: "late" },
      { period: "2026-09", status: null },
      { period: "2026-10", status: "pending" },
    ]);
  });
});

describe("dueProgress", () => {
  it("runs from the start of the month to the due date", () => {
    expect(dueProgress("2026-10", "2026-10-11T00:00:00", new Date("2026-10-01T00:00:00"))).toBe(0);
    expect(dueProgress("2026-10", "2026-10-11T00:00:00", new Date("2026-10-06T00:00:00"))).toBeCloseTo(0.5);
    expect(dueProgress("2026-10", "2026-10-11T00:00:00", new Date("2026-10-20T00:00:00"))).toBe(1);
  });
});
