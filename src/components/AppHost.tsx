import { useSettings } from "@/utils/settings";
import { Host } from "@expo/ui";
import { useMaterialColors } from "@expo/ui/jetpack-compose";
import type { ComponentProps } from "react";
import { TextScaleBox } from "../../modules/scroll-reporter";

/** Host colour options for the user's chosen theme colour and light/dark mode. */
const useThemeOptions = () => {
  const { settings } = useSettings();
  return {
    seedColor: settings.seedColor ?? undefined,
    colorScheme:
      settings.themeMode === "system" ? undefined : settings.themeMode,
  } as const;
};

/**
 * The Material palette for the user's chosen colour and mode. Use instead of
 * `useMaterialColors()`, which only knows the wallpaper/system default when
 * called outside a themed host.
 */
export const useAppColors = () => useMaterialColors(useThemeOptions());

/**
 * `Host` themed with the user's colour, light/dark mode and text size. Use it
 * for every Compose screen so settings apply everywhere.
 */
export const AppHost = ({ children, ...props }: ComponentProps<typeof Host>) => {
  const { settings } = useSettings();
  return (
    <Host {...useThemeOptions()} {...props}>
      <TextScaleBox scale={settings.textScale}>{children}</TextScaleBox>
    </Host>
  );
};
