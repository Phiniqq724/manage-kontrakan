import { appReleasesApi } from "@/services/api";
import { downloadAndInstallApk, isNewerVersion } from "@/utils/app-update";
import { applyUpdate, fetchLatestUpdate, otaEnabled } from "@/utils/ota";
import Constants from "expo-constants";
import { useUpdates } from "expo-updates";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";

export const CURRENT_VERSION = Constants.expoConfig?.version ?? "—";

/** Outcome of a manual check that didn't restart or open the installer. */
export type UpdateResult = { title: string; text?: string; ok: boolean };

/**
 * App version and update state for the avatar menu. `available` is true when
 * a newer build (APK) is published or an OTA update has downloaded; `run`
 * installs the build, restarts into the update, or checks for one.
 */
export const useAppUpdate = () => {
  const { isUpdatePending } = useUpdates();
  const [newBuild, setNewBuild] = useState<{ version: string; apk_url: string | null } | null>(
    null,
  );

  useEffect(() => {
    appReleasesApi
      .getLatest()
      .then(({ data }) =>
        setNewBuild(data && isNewerVersion(CURRENT_VERSION, data.version) ? data : null),
      )
      .catch(() => {});
  }, []);

  const run = async (): Promise<UpdateResult | null> => {
    if (newBuild?.apk_url) {
      // In-app download + installer; older builds fall back to the browser.
      if (!(await downloadAndInstallApk(newBuild.apk_url, newBuild.version))) {
        await WebBrowser.openBrowserAsync(newBuild.apk_url);
      }
      return null;
    }
    if (isUpdatePending) {
      await applyUpdate();
      return null;
    }
    if (!otaEnabled()) return { title: "Sudah versi terbaru", ok: true };
    try {
      if ((await fetchLatestUpdate()) === "downloaded") {
        await applyUpdate();
        return null;
      }
      return { title: "Sudah versi terbaru", ok: true };
    } catch (err: any) {
      return { title: "Gagal cek pembaruan", text: err.message, ok: false };
    }
  };

  return {
    version: CURRENT_VERSION,
    newVersion: newBuild?.version ?? null,
    available: !!newBuild?.apk_url || isUpdatePending,
    run,
  };
};
