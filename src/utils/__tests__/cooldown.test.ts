/// <reference types="jest" />

import {
  REMINDER_COOLDOWN_MS,
  cooldownRemaining,
  formatCooldown,
} from "@/utils/cooldown";

describe("cooldownRemaining", () => {
  const NOW = 1_000_000_000;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("uses a 2 minute default cooldown", () => {
    expect(REMINDER_COOLDOWN_MS).toBe(120_000);
  });

  it("returns 0 when no reminder has been sent", () => {
    expect(cooldownRemaining(null)).toBe(0);
  });

  it("returns 0 when lastSentAt is 0 (never started)", () => {
    expect(cooldownRemaining(0)).toBe(0);
  });

  it("returns the remaining milliseconds during the cooldown", () => {
    expect(cooldownRemaining(NOW - 30_000)).toBe(90_000);
    expect(cooldownRemaining(NOW)).toBe(120_000);
  });

  it("returns 0 exactly when the cooldown elapses", () => {
    expect(cooldownRemaining(NOW - 120_000)).toBe(0);
  });

  it("never returns a negative value after the cooldown", () => {
    expect(cooldownRemaining(NOW - 500_000)).toBe(0);
  });

  it("accepts a custom cooldown duration", () => {
    expect(cooldownRemaining(NOW - 10_000, 60_000)).toBe(50_000);
    expect(cooldownRemaining(NOW - 60_000, 60_000)).toBe(0);
  });
});

describe("formatCooldown", () => {
  it("formats zero as 0:00", () => {
    expect(formatCooldown(0)).toBe("0:00");
  });

  it("pads seconds to two digits", () => {
    expect(formatCooldown(1_000)).toBe("0:01");
    expect(formatCooldown(59_000)).toBe("0:59");
  });

  it("formats whole minutes", () => {
    expect(formatCooldown(60_000)).toBe("1:00");
    expect(formatCooldown(120_000)).toBe("2:00");
  });

  it("rounds partial seconds up so the countdown never shows 0 early", () => {
    expect(formatCooldown(1)).toBe("0:01");
    expect(formatCooldown(61_001)).toBe("1:02");
    expect(formatCooldown(59_400)).toBe("1:00");
  });

  it("formats the full default cooldown", () => {
    expect(formatCooldown(REMINDER_COOLDOWN_MS)).toBe("2:00");
  });
});
