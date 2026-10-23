import * as Updates from "expo-updates";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

/** Minimum gap between automatic update checks (launch and coming back to the app). */
export const AUTO_CHECK_GAP_MS = 5 * 60 * 1000;

/** Whether OTA updates work in this build (off in dev builds). */
export const otaEnabled = () => Updates.isEnabled && !__DEV__;

/** Whether enough time passed since `lastCheck` (ms, 0 = never) for another automatic check. */
export const shouldAutoCheck = (lastCheck: number, now: number) =>
  now - lastCheck >= AUTO_CHECK_GAP_MS;

/**
 * Asks the update server for a newer update and downloads it.
 * Resolves "downloaded" when one is ready to apply on restart, "latest" when
 * the app is already up to date.
 */
export const fetchLatestUpdate = async (): Promise<"latest" | "downloaded"> => {
  const { isAvailable } = await Updates.checkForUpdateAsync();
  if (!isAvailable) return "latest";
  await Updates.fetchUpdateAsync();
  return "downloaded";
};

/** Restarts the app into the downloaded update. */
export const applyUpdate = () => Updates.reloadAsync();

/**
 * Checks for and downloads updates on mount and whenever the app comes back
 * to the foreground (at most once per `AUTO_CHECK_GAP_MS`). Errors are
 * ignored; the next check tries again.
 */
export const useAutoUpdateCheck = () => {
  const lastCheck = useRef(0);

  useEffect(() => {
    if (!otaEnabled()) return;
    const check = () => {
      const now = Date.now();
      if (!shouldAutoCheck(lastCheck.current, now)) return;
      lastCheck.current = now;
      fetchLatestUpdate().catch(() => {});
    };
    check();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => sub.remove();
  }, []);
};
