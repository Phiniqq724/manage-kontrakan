import { averageScore, buildReel, isRare, RARE_PRIZE, REEL_ABOVE, vsAverageLabel, periodLabel, periodOf, PRIZES, prizeLabel } from "../motm";

describe("motm utils", () => {
  it("lists the six prizes plus the rare one", () => {
    expect(PRIZES.map(prizeLabel)).toEqual([
      "CASH 50k", "CASH 30k", "CASH 25k", "BILL DISC 50k", "BILL DISC 30k", "BILL DISC 25k",
      "BILL DISC 75k",
    ]);
    expect(PRIZES.filter(isRare)).toEqual([RARE_PRIZE]);
  });

  it("labels periods in Indonesian", () => {
    expect(periodLabel("2026-10")).toBe("Oktober 2026");
  });

  it("steps periods across years", () => {
    const now = new Date(2026, 0, 15);
    expect(periodOf(0, now)).toBe("2026-01");
    expect(periodOf(-1, now)).toBe("2025-12");
  });

  it("puts random prizes above and below the won prize", () => {
    const won = { prize: "cash", amount: 25000 } as const;
    const reel = buildReel(won, 5, () => 0);
    expect(reel).toHaveLength(REEL_ABOVE + 1 + 5);
    expect(reel[REEL_ABOVE]).toBe(won);
    expect(reel[0]).toEqual(PRIZES[0]);
    expect(reel[REEL_ABOVE + 1]).toEqual(PRIZES[0]);
  });

  it("compares a score with the average", () => {
    const avg = averageScore([90, 85, 60, 45]);
    expect(avg).toBe(70);
    expect(vsAverageLabel(90, avg)).toBe("+20 di atas rata-rata");
    expect(vsAverageLabel(45, avg)).toBe("-25 di bawah rata-rata");
    expect(vsAverageLabel(70, avg)).toBe("Pas rata-rata");
    expect(averageScore([])).toBe(0);
  });
});
