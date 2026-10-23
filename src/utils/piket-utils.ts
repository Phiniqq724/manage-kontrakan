/** Formats a Date as "YYYY-MM-DD" in local time. */
export const toDateStr = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Returns today's date as "YYYY-MM-DD" in local time. */
export const getTodayStr = (): string => toDateStr(new Date());

/** Parses "YYYY-MM-DD" as a local-time Date (avoids the UTC shift of `new Date(str)`). */
export const parseDay = (day: string): Date => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** Builds `count` consecutive "YYYY-MM-DD" strings starting at `start`. */
export const buildDateStrip = (start: string, count: number): string[] => {
  const s = parseDay(start);
  return Array.from({ length: count }, (_, i) =>
    toDateStr(new Date(s.getFullYear(), s.getMonth(), s.getDate() + i)),
  );
};

/** Groups rows by their `day` field, keeping input order within each day. */
export const groupByDay = <T extends { day: string }>(rows: T[]): Record<string, T[]> => {
  const map: Record<string, T[]> = {};
  rows.forEach((r) => (map[r.day] ??= []).push(r));
  return map;
};

/** Keeps only the days (in order) on which `userId` is assigned. */
export const filterMineDays = <T extends { assign_to: string | null }>(
  days: string[],
  byDay: Record<string, T[]>,
  userId: string | undefined,
): string[] => days.filter((d) => byDay[d]?.some((p) => p.assign_to === userId));

type Slot = { day: string; assign_to: string | null; status: string; extra?: boolean };

/** Statuses of a scheduled piket that still has to be done. */
const OPEN = ["pending", "izin"];

/** Earliest unfinished scheduled piket for `userId` on or after `today`, or null. */
export const findNextMine = <T extends Slot>(
  rows: T[],
  userId: string | undefined,
  today: string,
): T | null =>
  rows
    .filter(
      (p) =>
        !p.extra &&
        p.assign_to === userId &&
        p.day >= today &&
        !["done", "review"].includes(p.status),
    )
    .sort((a, b) => a.day.localeCompare(b.day))[0] ?? null;

/**
 * Whether a piket shows on the piket page. Rejected extras are hidden so they
 * don't pile up; they still count toward the daily extra limit.
 */
export const isShownPiket = (p: { extra: boolean; status: string }): boolean =>
  !(p.extra && p.status === "rejected");

/** Extra piket a member may submit per day. */
export const EXTRA_PER_DAY = 2;

/** Points per approved piket, as scored by `member_points`. */
export const POINTS = { own: 10, extra: 5, rentOnTime: 30 } as const;

/**
 * Why `userId` can't submit an extra piket today, or null when they can.
 * Mirrors the checks in the `submit_extra_piket` RPC: your own piket comes
 * first, and there's a daily limit.
 */
export const extraBlockReason = <T extends Slot>(
  todayRows: T[],
  userId: string | undefined,
): string | null => {
  const mine = todayRows.filter((p) => p.assign_to === userId);
  if (mine.some((p) => !p.extra && [...OPEN, "rejected"].includes(p.status)))
    return "Selesaikan dulu piket kamu sendiri hari ini.";
  if (mine.filter((p) => p.extra).length >= EXTRA_PER_DAY)
    return `Kamu sudah ${EXTRA_PER_DAY} kali piket tambahan hari ini.`;
  return null;
};

/**
 * Whether an izin request still needs an answer: pending, and its piket is
 * today or later and not handled yet. The server expires the rest nightly;
 * this hides them right away.
 */
export const isRequestOpen = (
  req: { status: string },
  piket: Slot | undefined,
  today: string,
): boolean =>
  req.status === "pending" && !!piket && piket.day >= today && OPEN.includes(piket.status);

/** Indonesian relative label: "Hari ini", "Besok", or "N hari lagi". */
export const relativeDay = (day: string, today: string): string => {
  const diff = Math.round((parseDay(day).getTime() - parseDay(today).getTime()) / 86400000);
  return diff <= 0 ? "Hari ini" : diff === 1 ? "Besok" : `${diff} hari lagi`;
};

/**
 * Days before `today` that have piket rows, oldest first. The history strip
 * shows them left to right and opens at its right end (the newest day).
 */
export const pastDays = <T>(byDay: Record<string, T[]>, today: string): string[] =>
  Object.keys(byDay)
    .filter((d) => d < today)
    .sort();
