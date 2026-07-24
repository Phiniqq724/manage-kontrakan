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

/**
 * Downloads an APK to the app cache and launches the Android package installer.
 *
 * The native modules (`expo-file-system`, `expo-intent-launcher`) are loaded
 * lazily via `require` so this stays safe to run in builds — or OTA updates —
 * that don't include them (e.g. an older install that predates this feature).
 * In that case, or on non-Android platforms, it resolves to `false` so the
 * caller can fall back to opening the download URL in a browser.
 *
 * @param apkUrl - Direct URL to the `.apk` file.
 * @param version - Version label, used to name the cached file.
 * @returns True if the native installer was launched, false if unsupported/failed.
 */
export async function downloadAndInstallApk(
  apkUrl: string,
  version: string,
): Promise<boolean> {
  const { Platform } = require("react-native");
  if (Platform.OS !== "android") return false;
  try {
    const { File, Directory, Paths } = require("expo-file-system");
    const IntentLauncher = require("expo-intent-launcher");

    // Fresh directory each time so a re-download never collides with a
    // previously cached APK of the same name.
    const dir = new Directory(Paths.cache, "updates");
    if (dir.exists) dir.delete();
    dir.create();

    const file = await File.downloadFileAsync(apkUrl, dir);
    await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
      data: file.contentUri,
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
      type: "application/vnd.android.package-archive",
    });
    return true;
  } catch {
    return false;
  }
}
