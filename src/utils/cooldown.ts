export const REMINDER_COOLDOWN_MS = 2 * 60 * 1000;

/** Milliseconds left before another reminder can be sent; 0 once the cooldown has elapsed or never started. */
export function cooldownRemaining(
  lastSentAt: number | null,
  cooldownMs: number = REMINDER_COOLDOWN_MS,
): number {
  if (!lastSentAt) return 0;
  return Math.max(0, cooldownMs - (Date.now() - lastSentAt));
}

/** Formats milliseconds left on a cooldown as an "M:SS" countdown label. */
export function formatCooldown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
