/** Returns today's date as "YYYY-MM-DD" in local time. */
export function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Returns true if today is past the last Sunday of the current month.
 * Used to gate monthly piket schedule generation.
 */
export function isEndOfMonth(): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sundays = getSundaysOfMonth(today.getFullYear(), today.getMonth() + 1);
  if (sundays.length === 0) return true;
  const lastSunday = sundays[sundays.length - 1];
  return today > lastSunday;
}

/** Returns all Sundays in a given month as Date objects. */
export function getSundaysOfMonth(year: number, month: number): Date[] {
  const sundays: Date[] = [];
  const d = new Date(year, month - 1, 1);
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
  while (d.getMonth() === month - 1) {
    sundays.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  return sundays;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Generates piket insert rows for all Sundays in a month.
 * 2 unique users are assigned per Sunday, rotating fairly across all users.
 */
export function generatePiketRows(
  userIds: string[],
  year: number,
  month: number,
): Array<{ day: string; assign_to: string; status: string; finished: boolean }> {
  const sundays = getSundaysOfMonth(year, month);
  const shuffled = shuffle([...userIds]);
  const n = shuffled.length;
  const rows: Array<{ day: string; assign_to: string; status: string; finished: boolean }> = [];

  for (let i = 0; i < sundays.length; i++) {
    const day = toDateStr(sundays[i]);
    // Pick two unique users using modular indexing on the shuffled list
    const a = shuffled[(i * 2) % n];
    const b = shuffled[(i * 2 + 1) % n];
    // If they happen to be the same (only possible if n === 1), use the next slot
    const second = a === b ? shuffled[(i * 2 + 2) % n] : b;
    rows.push({ day, assign_to: a, status: "pending", finished: false });
    rows.push({ day, assign_to: second, status: "pending", finished: false });
  }

  return rows;
}
