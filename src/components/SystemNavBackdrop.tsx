import { useAppColors } from "@/components/AppHost";
import { useSettings } from "@/utils/settings";
import { NavigationBar } from "expo-navigation-bar";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Solid background behind the phone's gesture/navigation bar, so page content
 * never shows through it. Its handle follows the app's light/dark mode.
 */
export const SystemNavBackdrop = () => {
  const colors = useAppColors();
  const { bottom } = useSafeAreaInsets();
  const { themeMode } = useSettings().settings;
  return (
    <>
      <NavigationBar
        style={themeMode === "dark" ? "light" : themeMode === "light" ? "dark" : "auto"}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: bottom,
          backgroundColor: colors.surfaceContainer,
        }}
      />
    </>
  );
};
