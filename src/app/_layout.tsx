import { useAppColors } from "@/components/AppHost";
import { getMaterialColors } from "@expo/ui/jetpack-compose";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { KeyboardProvider } from "react-native-keyboard-controller";
import * as SystemUI from "expo-system-ui";
import { AppTabBar } from "../components/AppTabBar";
import { SystemNavBackdrop } from "../components/SystemNavBackdrop";
import { UpdateBanner } from "../components/UpdateBanner";
import { AuthProvider, useAuth } from "../utils/auth-context";
import {
  handlePiketPartnerResponse,
  handlePiketPlanNotificationResponse,
  registerPiketPartnerCategory,
  registerPiketPlanCategory,
  registerRuleVoteCategory,
} from "../utils/notifications";
import { handleRuleVoteNotificationResponse } from "../utils/rule-requests";
import { loadSettings, SettingsProvider, useSettings } from "../utils/settings";
import { TabActionProvider } from "../utils/tab-action";
import { setAppNightMode } from "../../modules/scroll-reporter";

SplashScreen.preventAutoHideAsync();

// Set the native root view background before first paint so the Android
// predictive-back preview and screen transitions don't flash the default
// white window background behind our Material You-colored screens.
// Uses the saved theme so a dark-mode user never sees a light flash on launch.
const saved = (() => {
  try {
    return loadSettings(localStorage.getItem("semanggi.settings"));
  } catch {
    return loadSettings(null);
  }
})();
SystemUI.setBackgroundColorAsync(
  getMaterialColors({
    seedColor: saved.seedColor ?? undefined,
    scheme: saved.themeMode === "system" ? undefined : saved.themeMode,
  }).background,
);

/** Keeps the native splash up until the session check finishes. */
const HideSplashWhenReady = () => {
  const { loading } = useAuth();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  return null;
};

export default function RootLayout() {
  return (
    <SettingsProvider>
      <RootContent />
    </SettingsProvider>
  );
}

function RootContent() {
  const colors = useAppColors();
  const { settings } = useSettings();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  useEffect(() => {
    setAppNightMode(settings.themeMode);
  }, [settings.themeMode]);

  useEffect(() => {
    registerRuleVoteCategory();
    registerPiketPlanCategory();
    registerPiketPartnerCategory();

    const handleResponse = (
      response: Notifications.NotificationResponse,
      coldStart = false,
    ) => {
      handleRuleVoteNotificationResponse(response);
      handlePiketPlanNotificationResponse(response);
      // Background/closed taps go through the notification task instead. Not
      // on cold start: the stored last tap would snooze again hours later.
      if (!coldStart) handlePiketPartnerResponse(
        response.actionIdentifier,
        response.notification.request.content.data?.day,
        response.notification.request.identifier,
      );
    };

    // Cold start: app was killed and opened by tapping a notification action.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleResponse(response, true);
    });

    // Foreground/backgrounded taps.
    const subscription =
      Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => subscription.remove();
  }, []);

  // The native splash stays visible until fonts and the session are ready.
  if (!loaded) return null;

  return (
    <KeyboardProvider>
      <AuthProvider>
        <TabActionProvider>
          <HideSplashWhenReady />
          <StatusBar
            style={
              settings.themeMode === "dark"
                ? "light"
                : settings.themeMode === "light"
                  ? "dark"
                  : "auto"
            }
          />
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
              <Stack.Screen name="receipts" />
            <Stack.Screen name="events" />
            <Stack.Screen name="requests" />
            <Stack.Screen name="members" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="piket" />
          <Stack.Screen name="guests" />
          <Stack.Screen name="shopping" />
          <Stack.Screen name="rules" />
          </Stack>
          {/* Solid strip behind the phone's gesture bar, under the app navbar. */}
        <SystemNavBackdrop />
        {/* One floating navbar over every signed-in page. */}
          <AppTabBar />
          {/* "Pembaruan siap" bar once an OTA update has downloaded. */}
          <UpdateBanner />
        </TabActionProvider>
      </AuthProvider>
    </KeyboardProvider>
  );
}
