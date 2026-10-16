/// <reference types="jest" />

import { addVoteToTally, countByPriority, filterByPriority, voteFractions } from "@/utils/rule-utils";

describe("voteFractions", () => {
  it("splits votes against the eligible count", () => {
    expect(voteFractions(1, 1, 4)).toEqual({ approve: 0.25, decline: 0.25, rest: 0.5 });
  });
  it("handles an empty electorate", () => {
    expect(voteFractions(0, 0, 0)).toEqual({ approve: 0, decline: 0, rest: 0 });
  });
  it("never overflows when votes exceed eligible", () => {
    const f = voteFractions(3, 1, 2);
    expect(f.approve + f.decline + f.rest).toBeCloseTo(1);
    expect(f.rest).toBe(0);
  });
});

describe("addVoteToTally", () => {
  it("counts an approve vote on a missing tally", () => {
    expect(addVoteToTally(undefined, "approve")).toEqual({ approve_count: 1, decline_count: 0, total_votes: 1 });
  });
  it("counts a decline vote", () => {
    expect(addVoteToTally({ approve_count: 2, decline_count: 0, total_votes: 2 }, "decline")).toEqual({
      approve_count: 2,
      decline_count: 1,
      total_votes: 3,
    });
  });
});

describe("countByPriority / filterByPriority", () => {
  const rules = [{ priority: "high" }, { priority: "low" }, { priority: "high" }, { priority: "weird" }];
  it("counts per priority and total", () => {
    expect(countByPriority(rules)).toEqual({ all: 4, high: 2, medium: 0, low: 1 });
  });
  it("filters by priority", () => {
    expect(filterByPriority(rules, "high")).toHaveLength(2);
    expect(filterByPriority(rules, "all")).toHaveLength(4);
    expect(filterByPriority(rules, "medium")).toHaveLength(0);
  });
});
