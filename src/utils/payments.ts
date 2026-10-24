/** The fields these helpers need from a payment row. */
export type PaymentLike = { period: string; status: string; due_date?: string | null };

/** "2026-10" -> "2026-09" (and across years). */
export function previousPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** Still open: nothing decided yet for this month. */
const isOpen = (status: string) =>
  status === "waiting_payment" || status === "rejected" || status === "pending";

/**
 * Months in a row paid on time, counting back from the newest month. The
 * current month only counts once it's settled; while it's still open it
 * neither adds nor breaks the streak. A late, missing or unpaid month ends it.
 */
export function onTimeStreak(payments: PaymentLike[], currentPeriod: string): number {
  const byPeriod = new Map(payments.map((p) => [p.period, p.status]));
  let period = currentPeriod;
  const current = byPeriod.get(period);
  if (current === undefined || isOpen(current)) period = previousPeriod(period);
  let streak = 0;
  while (byPeriod.get(period) === "on_time") {
    streak++;
    period = previousPeriod(period);
  }
  return streak;
}

/**
 * The last `count` months up to `currentPeriod`, oldest first, each with its
 * payment status (null when there was no bill that month).
 */
export function recentMonths(
  payments: PaymentLike[],
  currentPeriod: string,
  count = 6,
): { period: string; status: string | null }[] {
  const byPeriod = new Map(payments.map((p) => [p.period, p.status]));
  const months: string[] = [];
  let period = currentPeriod;
  for (let i = 0; i < count; i++) {
    months.unshift(period);
    period = previousPeriod(period);
  }
  return months.map((p) => ({ period: p, status: byPeriod.get(p) ?? null }));
}

/**
 * How far the month has run towards the due date, 0 at the start of the
 * billing month and 1 on (or after) the due date.
 */
export function dueProgress(period: string, dueDate: string, now: Date): number {
  const start = new Date(`${period}-01T00:00:00`).getTime();
  const due = new Date(dueDate).getTime();
  if (!(due > start)) return 1;
  return Math.min(1, Math.max(0, (now.getTime() - start) / (due - start)));
}

/** 250000 -> "Rp 250.000". */
export const formatRupiah = (amount: number) => `Rp ${amount.toLocaleString("id-ID")}`;
