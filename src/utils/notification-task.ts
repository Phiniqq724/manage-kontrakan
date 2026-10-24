import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { handlePiketPartnerResponse } from "./notifications";

/**
 * Runs when a notification button is tapped while the app is in the
 * background or closed (Android), so buttons like "10 menit lagi" work
 * without opening the app. Defined at module scope from the app entry
 * (index.ts), because a closed app starts headless and never renders.
 */
export const BACKGROUND_NOTIFICATION_TASK = "background-notification";

TaskManager.defineTask<Notifications.NotificationTaskPayload>(
  BACKGROUND_NOTIFICATION_TASK,
  async ({ data }) => {
    if (data && "actionIdentifier" in data) {
      const response = data;
      await handlePiketPartnerResponse(
        response.actionIdentifier,
        response.notification?.request?.content?.data?.day,
        response.notification?.request?.identifier,
      );
    }
    return Notifications.BackgroundNotificationTaskResult.NoData;
  },
);

Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK).catch((err) =>
  console.error("[notification-task] register failed:", err),
);
