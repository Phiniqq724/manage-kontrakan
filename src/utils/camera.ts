/** Smallest capture size we want; uploads are downscaled to this anyway. */
export const TARGET_LONG_SIDE = 1080;

/**
 * Picks the smallest 4:3 picture size whose long side still covers
 * TARGET_LONG_SIDE, so the camera never captures (and the phone never has to
 * decode and shrink) a full-resolution sensor image. Falls back to any size
 * when no 4:3 one fits, and to undefined (camera default) when none parse.
 */
export function pickPictureSize(sizes: string[]): string | undefined {
  const parsed = sizes
    .map((s) => {
      const [w, h] = s.split("x").map(Number);
      return { s, long: Math.max(w, h), short: Math.min(w, h) };
    })
    .filter((p) => p.long >= TARGET_LONG_SIDE && p.short > 0)
    .sort((a, b) => a.long - b.long);
  const fourByThree = parsed.find(
    (p) => Math.abs(p.long / p.short - 4 / 3) < 0.02,
  );
  return (fourByThree ?? parsed[0])?.s;
}
