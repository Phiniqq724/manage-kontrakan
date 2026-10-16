import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "./supabase";

const RULE_VOTE_CATEGORY = "rule_vote";

/**
 * Registers the actionable notification category for rule-vote pushes,
 * so members can tap Setuju/Tolak directly from the notification.
 */
export async function registerRuleVoteCategory(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(RULE_VOTE_CATEGORY, [
    {
      identifier: "approve",
      buttonTitle: "Setuju",
      options: { opensAppToForeground: false },
    },
    {
      identifier: "decline",
      buttonTitle: "Tolak",
      options: { opensAppToForeground: false },
    },
  ]);
}

/** EAS project id from app config, used to request the Expo push token. */
const getProjectId = (): string | undefined =>
  Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

// Registrations run one at a time. A repeat call for the same user joins the
// in-flight one (e.g. fetchUser firing twice on mount); a call for a different
// user (account switch/link) waits for it instead of being dropped.
let _inFlight: Promise<void> | null = null;
let _inFlightUserId: string | null = null;

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
 * and saves it to the owner-only push_tokens table.
 *
 * Calls are serialized so account switching can't interleave two
 * registrations; see `_inFlight`.
 */
export async function registerForPushNotifications(
  userId: string,
): Promise<void> {
  if (!Device.isDevice) return;
  if (_inFlight && _inFlightUserId === userId) return _inFlight;

  const run = (_inFlight ?? Promise.resolve())
    .catch(() => {})
    .then(() => registerTokenFor(userId));
  _inFlight = run;
  _inFlightUserId = userId;
  try {
    await run;
  } finally {
    if (_inFlight === run) {
      _inFlight = null;
      _inFlightUserId = null;
    }
  }
}

/**
 * Does the actual registration for one user. Skips the write when the active
 * session no longer belongs to `userId`: linking or switching accounts briefly
 * signs in as another user, and RLS only allows writing your own token row.
 */
async function registerTokenFor(userId: string): Promise<void> {
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
    await Notifications.getExpoPushTokenAsync({ projectId: getProjectId() })
  ).data;

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user.id !== userId) return;

  const { error } = await supabase.from("push_tokens").upsert(
    { user_id: userId, token, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );

  if (error) throw new Error(`Gagal menyimpan push token: ${error.message}`);
}

/** Who receives a push; resolved server-side by the send-push edge function. */
export type PushRecipients =
  | "admin"
  | "all_except_me"
  | "voters_except_me"
  | string[];

/** Notification types a user can mute in Pengaturan. Untyped pushes always arrive. */
export const NOTIFICATION_TYPES = {
  guest: "Tamu",
  rule: "Aturan & vote",
  event: "Acara",
  request: "Permintaan",
  piket: "Piket",
  payment: "Pembayaran",
} as const;
export type NotificationType = keyof typeof NOTIFICATION_TYPES;

export type SendPushParams = {
  recipients: PushRecipients;
  /** Lets recipients who muted this type skip it. Omit for must-see pushes. */
  type?: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  categoryId?: string;
};

/**
 * Asks the `send-push` edge function to notify recipients. Tokens never reach
 * the client: recipients are named by role or user id (max 50 ids) and resolved
 * on the server. Never throws; failures are logged so they cannot break the
 * calling flow.
 */
export async function sendPush({
  recipients,
  type,
  title,
  body,
  data,
  categoryId,
}: SendPushParams): Promise<void> {
  try {
    const { data: result, error } = await supabase.functions.invoke(
      "send-push",
      { body: { recipients, type, title, body, data, categoryId } },
    );
    if (error) {
      console.error("[push] failed:", error);
      return;
    }
    if (__DEV__) {
      console.log("[push] response:", JSON.stringify(result));
    }
  } catch (err) {
    console.error("[push] failed:", err);
  }
}

/**
 * The signed-in user's muted notification types, or null when this user has
 * no push token yet (notifications not set up on any phone).
 */
export async function getMutedTypes(userId: string): Promise<NotificationType[] | null> {
  const { data } = await supabase
    .from("push_tokens")
    .select("muted_types")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return (data.muted_types ?? []).filter(
    (t: string): t is NotificationType => t in NOTIFICATION_TYPES,
  );
}

/** Saves the signed-in user's muted notification types. */
export async function setMutedTypes(
  userId: string,
  types: NotificationType[],
): Promise<void> {
  const { error } = await supabase
    .from("push_tokens")
    .update({ muted_types: types })
    .eq("user_id", userId);
  if (error) throw error;
}
