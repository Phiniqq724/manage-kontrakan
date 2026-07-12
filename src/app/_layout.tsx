import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { Colors } from "../constants/theme";
import { AuthProvider } from "../utils/auth-context";
import { registerRuleVoteCategory } from "../utils/notifications";
import { handleRuleVoteNotificationResponse } from "../utils/rule-requests";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

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

  if (!loaded) return null;

  return (
    <KeyboardProvider>
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.bg },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="payments" />
        <Stack.Screen name="changelog" />
      </Stack>
    </AuthProvider>
    </KeyboardProvider>
  );
}
