import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "./supabase";

/** Fetches the admin's push token from the database. Returns null if admin has no token. */
export async function getAdminToken(): Promise<string | null> {
  const { data } = await supabase
    .from("users")
    .select("push_token")
    .eq("role", "admin")
    .single();
  return data?.push_token ?? null;
}

const EXPO_PROJECT_ID = "968c2fca-1d0f-4f42-a469-09502a4405b8";

// Prevents duplicate concurrent registration calls (e.g. fetchUser firing twice on mount)
let _registering = false;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Requests notification permission, gets the Expo push token,
 * and saves it to the user's row in the database.
 */
export async function registerForPushNotifications(
  userId: string,
): Promise<void> {
  if (!Device.isDevice || _registering) return;
  _registering = true;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") return;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const token = (
      await Notifications.getExpoPushTokenAsync({ projectId: EXPO_PROJECT_ID })
    ).data;

    const { error } = await supabase
      .from("users")
      .update({ push_token: token })
      .eq("id", userId);

    if (error) throw new Error(`Gagal menyimpan push token: ${error.message}`);
  } finally {
    _registering = false;
  }
}

/**
 * Sends a push notification to a recipient via the Expo Push API.
 * Failures are silenced so they never break the calling flow.
 */
export async function sendPushNotification(
  recipientToken: string,
  title: string,
  body: string,
): Promise<void> {
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ to: recipientToken, title, body }),
    });
    if (__DEV__) {
      const json = await res.json();
      console.log("[push] response:", JSON.stringify(json));
    }
  } catch (err) {
    console.error("[push] failed:", err);
  }
}
