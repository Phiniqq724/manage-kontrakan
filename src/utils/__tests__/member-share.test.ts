/// <reference types="jest" />

import {
  calcNewMemberShare,
  monthsLeftInContract,
  parseAmount,
} from "@/utils/member-share";

describe("calcNewMemberShare", () => {
  it("matches the 25jt, 5 members, 8 months example", () => {
    const share = calcNewMemberShare(25_000_000, 5, 8);
    expect(share.yearlyBefore).toBe(5_000_000); // 25jt / 5
    expect(share.yearlyAfter).toBe(4_166_667); // 25jt / 6
    expect(share.newMemberPays).toBe(2_777_778); // 25jt / 6 x 8/12
    expect(share.eachCurrentReceives).toBe(555_556); // 2.777.778 / 5
  });

  it("charges a full year share when the new member stays 12 months", () => {
    const share = calcNewMemberShare(24_000_000, 3, 12);
    expect(share.yearlyAfter).toBe(6_000_000);
    expect(share.newMemberPays).toBe(6_000_000);
    expect(share.eachCurrentReceives).toBe(2_000_000);
  });

  it("gives nothing back when there are no current members", () => {
    const share = calcNewMemberShare(12_000_000, 0, 2);
    expect(share.yearlyBefore).toBe(0);
    expect(share.newMemberPays).toBe(2_000_000);
    expect(share.eachCurrentReceives).toBe(0);
  });

  it.each([
    [0, 5, 3],
    [25_000_000, 5, 0],
    [25_000_000, -1, 3],
    [Number.NaN, 5, 3],
  ])("returns zeros for invalid input (%p, %p, %p)", (rent, members, months) => {
    expect(calcNewMemberShare(rent, members, months)).toEqual({
      yearlyBefore: 0,
      yearlyAfter: 0,
      newMemberPays: 0,
      eachCurrentReceives: 0,
    });
  });
});

describe("monthsLeftInContract", () => {
  it("counts from a July start, treating the current month as used", () => {
    expect(monthsLeftInContract(new Date(2026, 9, 16))).toBe(8); // October
    expect(monthsLeftInContract(new Date(2026, 6, 1))).toBe(11); // July
    expect(monthsLeftInContract(new Date(2027, 0, 10))).toBe(5); // January
    expect(monthsLeftInContract(new Date(2027, 5, 30))).toBe(0); // June
  });
});

describe("parseAmount", () => {
  it("reads plain and dotted amounts", () => {
    expect(parseAmount("25000000")).toBe(25_000_000);
    expect(parseAmount("25.000.000")).toBe(25_000_000);
    expect(parseAmount("Rp 1.500")).toBe(1_500);
  });

  it("treats empty or non-numeric text as 0", () => {
    expect(parseAmount("")).toBe(0);
    expect(parseAmount("abc")).toBe(0);
  });
});
