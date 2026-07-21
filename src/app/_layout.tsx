import { getMaterialColors, useMaterialColors } from "@expo/ui/jetpack-compose";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { KeyboardProvider } from "react-native-keyboard-controller";
import * as SystemUI from "expo-system-ui";
import { LoadingScreen } from "../components/LoadingScreen";
import { AuthProvider } from "../utils/auth-context";
import { registerRuleVoteCategory } from "../utils/notifications";
import { handleRuleVoteNotificationResponse } from "../utils/rule-requests";

SplashScreen.preventAutoHideAsync();

// Set the native root view background before first paint so the Android
// predictive-back preview and screen transitions don't flash the default
// white window background behind our Material You-colored screens.
SystemUI.setBackgroundColorAsync(getMaterialColors().background);

export default function RootLayout() {
  const colors = useMaterialColors();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    // Hand off from the native splash to our own <LoadingScreen /> as soon
    // as this first frame has committed, instead of waiting on fonts.
    SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  useEffect(() => {
    registerRuleVoteCategory();

    // Cold start: app was killed and opened by tapping a notification action.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleRuleVoteNotificationResponse(response);
    });

    // Foreground/backgrounded taps.
    const subscription = Notifications.addNotificationResponseReceivedListener(
      handleRuleVoteNotificationResponse,
    );
    return () => subscription.remove();
  }, []);

  if (!loaded) return <LoadingScreen />;

  return (
    <KeyboardProvider>
      <AuthProvider>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: "slide_from_right",
            freezeOnBlur: true,
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="auth/login" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="admin" />
          <Stack.Screen name="changelog" />
          <Stack.Screen name="split-bill" />
          <Stack.Screen name="receipts" />
        </Stack>
      </AuthProvider>
    </KeyboardProvider>
  );
}
