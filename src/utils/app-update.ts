/**
 * Compares two semver-like version strings (e.g. "2.1.0").
 *
 * Only the dot-separated numeric segments are considered; any non-numeric
 * segment is treated as 0, and missing trailing segments are padded with 0
 * so that "2.1" and "2.1.0" compare as equal.
 *
 * @param a - First version string.
 * @param b - Second version string.
 * @returns 1 if `a` is newer than `b`, -1 if older, 0 if equal.
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

/**
 * Determines whether `latest` is a strictly newer version than `current`.
 *
 * @param current - The installed app version.
 * @param latest - The latest published release version.
 * @returns True when an update is available.
 */
export function isNewerVersion(current: string, latest: string): boolean {
  return compareVersions(latest, current) > 0;
}
