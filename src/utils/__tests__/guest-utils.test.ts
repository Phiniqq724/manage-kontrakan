/// <reference types="jest" />

import { dayLabel, durationLabel, groupByDay, whatsappLink } from "@/utils/guest-utils";

describe("guest-utils", () => {
  const now = new Date(2026, 9, 16, 12);

  it("formats durations", () => {
    expect(durationLabel(new Date(0), new Date(35 * 60000))).toBe("35m");
    expect(durationLabel(new Date(0), new Date(80 * 60000))).toBe("1j 20m");
    expect(durationLabel(new Date(60000), new Date(0))).toBe("0m");
  });

  it("builds WhatsApp links", () => {
    expect(whatsappLink("0812-3456 789")).toBe("https://wa.me/628123456789");
    expect(whatsappLink("+62812")).toBe("https://wa.me/62812");
    expect(whatsappLink("  ")).toBeNull();
    expect(whatsappLink(null)).toBeNull();
  });

  it("labels days", () => {
    expect(dayLabel(new Date(2026, 9, 16, 1), now)).toBe("Hari ini");
    expect(dayLabel(new Date(2026, 9, 15, 23), now)).toBe("Kemarin");
    expect(dayLabel(new Date(2026, 9, 5), now)).toContain("Oktober");
  });

  it("groups by day, newest first", () => {
    const mk = (id: string, d: Date) => ({ id, check_in: d.toISOString() });
    const groups = groupByDay(
      [mk("a", new Date(2026, 9, 15, 10)), mk("b", new Date(2026, 9, 16, 9)), mk("c", new Date(2026, 9, 16, 11))],
      now,
    );
    expect(groups.map((g) => g.label)).toEqual(["Hari ini", "Kemarin"]);
    expect(groups[0].items.map((g) => g.id)).toEqual(["c", "b"]);
  });
});
