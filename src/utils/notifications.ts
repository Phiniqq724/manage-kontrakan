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

const PIKET_PLAN_CATEGORY = "piket_plan";
const PIKET_PLAN_ACTIONS = { piket_ya: "ya", piket_malas: "malas" } as const;
const PIKET_NUDGE_TYPES = ["piket_nudge", "piket_reminder"];

/**
 * Registers the Ya / Malas buttons on the 06:30 "Pulang sekolah" reminder.
 * They open the app: without a background task, a closed app only sees the
 * tap on its next launch, too late to skip or add that day's reminders.
 */
export async function registerPiketPlanCategory(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(PIKET_PLAN_CATEGORY, [
    {
      identifier: "piket_ya",
      buttonTitle: "Ya",
      options: { opensAppToForeground: true },
    },
    {
      identifier: "piket_malas",
      buttonTitle: "Malas",
      options: { opensAppToForeground: true },
    },
  ]);
}

/** Maps a notification button to a piket plan answer, or null for other taps. */
export const piketPlanAnswerFor = (
  actionIdentifier: string,
): "ya" | "malas" | null =>
  PIKET_PLAN_ACTIONS[actionIdentifier as keyof typeof PIKET_PLAN_ACTIONS] ?? null;

/**
 * Saves a Ya / Malas tap. The server ignores answers for any day other than
 * the one the reminder was sent, so a late cold-start replay is harmless.
 */
export async function handlePiketPlanNotificationResponse(
  response: Notifications.NotificationResponse,
): Promise<void> {
  const answer = piketPlanAnswerFor(response.actionIdentifier);
  const day = response.notification.request.content.data?.day;
  if (!answer || typeof day !== "string") return;

  const { error } = await supabase.rpc("respond_piket_plan", {
    p_day: day,
    p_response: answer,
  });
  if (error) console.error("[piket-plan-notification] failed:", error);
}

const PIKET_PARTNER_CATEGORY = "piket_partner";
const PIKET_PARTNER_ACTIONS = {
  piket_snooze: "snooze",
  piket_partner_malas: "malas",
} as const;

/**
 * Registers the 10 menit lagi / Malas buttons on "X udah piket loh". They
 * don't open the app: the background notification task answers the server
 * (see notification-task.ts).
 */
export async function registerPiketPartnerCategory(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(PIKET_PARTNER_CATEGORY, [
    {
      identifier: "piket_snooze",
      buttonTitle: "10 menit lagi",
      options: { opensAppToForeground: false },
    },
    {
      identifier: "piket_partner_malas",
      buttonTitle: "Malas",
      options: { opensAppToForeground: false },
    },
  ]);
}

/** Maps a partner-nudge button to its server action, or null for other taps. */
export const piketPartnerActionFor = (
  actionIdentifier: string,
): "snooze" | "malas" | null =>
  PIKET_PARTNER_ACTIONS[actionIdentifier as keyof typeof PIKET_PARTNER_ACTIONS] ?? null;

/**
 * Sends a 10 menit lagi / Malas tap to the server and clears the notification.
 * Safe to run twice for one tap (foreground listener and background task):
 * a repeat snooze just moves the same reminder, a repeat Malas changes nothing.
 */
export async function handlePiketPartnerResponse(
  actionIdentifier: string,
  day: unknown,
  notificationId?: string,
): Promise<void> {
  const action = piketPartnerActionFor(actionIdentifier);
  if (!action || typeof day !== "string") return;
  const { error } = await supabase.rpc("respond_piket_partner", {
    p_day: day,
    p_action: action,
  });
  if (error) console.error("[piket-partner-notification] failed:", error);
  if (notificationId) {
    await Notifications.dismissNotificationAsync(notificationId).catch(() => {});
  }
}

/** Clears piket reminders still sitting in the tray, e.g. after submitting proof. */
export async function dismissPiketReminders(): Promise<void> {
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      presented
        .filter((n) =>
          PIKET_NUDGE_TYPES.includes(String(n.request.content.data?.type)),
        )
        .map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
    );
  } catch (err) {
    console.error("[piket-reminders] dismiss failed:", err);
  }
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
  shopping: "Belanja",
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
