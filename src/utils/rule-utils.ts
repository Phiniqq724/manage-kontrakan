export type Priority = "high" | "medium" | "low";
export type PriorityFilter = Priority | "all";
export type VoteChoice = "approve" | "decline";
export type VoteTally = { approve_count: number; decline_count: number; total_votes: number };

export const PRIORITIES: Priority[] = ["high", "medium", "low"];

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: "Penting",
  medium: "Perlu diperhatikan",
  low: "Saran",
};

/**
 * Splits the eligible voters into approve / decline / not-yet-voted shares (each 0..1,
 * summing to at most 1) for a two-tone progress bar. Votes beyond the eligible count are
 * scaled down so the bar never overflows, and an empty electorate yields all zeros.
 */
export const voteFractions = (approve: number, decline: number, eligible: number) => {
  const base = Math.max(eligible, approve + decline);
  if (base <= 0) return { approve: 0, decline: 0, rest: 0 };
  const a = approve / base;
  const d = decline / base;
  return { approve: a, decline: d, rest: Math.max(0, 1 - a - d) };
};

/** Returns a tally with one extra vote counted, for optimistic UI updates. */
export const addVoteToTally = (tally: VoteTally | undefined, vote: VoteChoice): VoteTally => {
  const t = tally ?? { approve_count: 0, decline_count: 0, total_votes: 0 };
  return {
    approve_count: t.approve_count + (vote === "approve" ? 1 : 0),
    decline_count: t.decline_count + (vote === "decline" ? 1 : 0),
    total_votes: t.total_votes + 1,
  };
};

/** Counts rules per priority, plus the total under the "all" key. */
export const countByPriority = (rules: { priority: string }[]): Record<PriorityFilter, number> => {
  const counts: Record<PriorityFilter, number> = { all: rules.length, high: 0, medium: 0, low: 0 };
  rules.forEach((r) => {
    if (r.priority in counts) counts[r.priority as Priority] += 1;
  });
  return counts;
};

/** Keeps only rules matching the selected priority filter ("all" keeps everything). */
export const filterByPriority = <T extends { priority: string }>(rules: T[], filter: PriorityFilter): T[] =>
  filter === "all" ? rules : rules.filter((r) => r.priority === filter);
