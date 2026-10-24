/// <reference types="jest" />

const mockGetSession = jest.fn();
const mockUpsert = jest.fn();
const mockRpc = jest.fn();
const mockGetPresented = jest.fn();
const mockDismiss = jest.fn();

jest.mock("expo-device", () => ({ isDevice: true }));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: "test-project" } } } },
}));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  setNotificationChannelAsync: jest.fn(async () => {}),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: "ExponentPushToken[x]" })),
  getPresentedNotificationsAsync: () => mockGetPresented(),
  dismissNotificationAsync: (id: string) => mockDismiss(id),
  AndroidImportance: { MAX: 5 },
}));
jest.mock("@/utils/supabase", () => ({
  supabase: {
    auth: { getSession: () => mockGetSession() },
    from: () => ({ upsert: (...args: unknown[]) => mockUpsert(...args) }),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import {
  dismissPiketReminders,
  handlePiketPlanNotificationResponse,
  piketPartnerActionFor,
  piketPlanAnswerFor,
  registerForPushNotifications,
} from "@/utils/notifications";

/** Makes getSession report `userId` as the signed-in user. */
const signedInAs = (userId: string) =>
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: userId } } } });

describe("registerForPushNotifications", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockUpsert.mockReset().mockResolvedValue({ error: null });
  });

  it("saves the token for the signed-in user", async () => {
    signedInAs("user-a");
    await registerForPushNotifications("user-a");
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert.mock.calls[0][0]).toMatchObject({ user_id: "user-a" });
  });

  it("skips the write when the session switched to another user", async () => {
    signedInAs("user-b");
    await expect(registerForPushNotifications("user-a")).resolves.toBeUndefined();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("runs a registration for a different user after the in-flight one instead of dropping it", async () => {
    signedInAs("user-b");
    await Promise.all([
      registerForPushNotifications("user-a"),
      registerForPushNotifications("user-b"),
    ]);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert.mock.calls[0][0]).toMatchObject({ user_id: "user-b" });
  });

  it("joins an in-flight registration for the same user", async () => {
    signedInAs("user-a");
    await Promise.all([
      registerForPushNotifications("user-a"),
      registerForPushNotifications("user-a"),
    ]);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it("still throws when the database rejects the write", async () => {
    signedInAs("user-a");
    mockUpsert.mockResolvedValue({ error: { message: "boom" } });
    await expect(registerForPushNotifications("user-a")).rejects.toThrow(
      "Gagal menyimpan push token: boom",
    );
  });
});

/** A notification response tapped with `actionIdentifier`, carrying `data`. */
const responseFor = (actionIdentifier: string, data: Record<string, unknown>) =>
  ({ actionIdentifier, notification: { request: { content: { data } } } }) as any;

describe("piketPlanAnswerFor", () => {
  it("maps the Ya / Malas buttons and ignores everything else", () => {
    expect(piketPlanAnswerFor("piket_ya")).toBe("ya");
    expect(piketPlanAnswerFor("piket_malas")).toBe("malas");
    expect(piketPlanAnswerFor("approve")).toBeNull();
    expect(piketPlanAnswerFor("expo.modules.notifications.actions.DEFAULT")).toBeNull();
  });
});

describe("handlePiketPlanNotificationResponse", () => {
  beforeEach(() => mockRpc.mockReset().mockResolvedValue({ error: null }));

  it("saves the answer for the day the reminder was sent", async () => {
    await handlePiketPlanNotificationResponse(
      responseFor("piket_malas", { type: "piket_nudge", day: "2026-10-23" }),
    );
    expect(mockRpc).toHaveBeenCalledWith("respond_piket_plan", {
      p_day: "2026-10-23",
      p_response: "malas",
    });
  });

  it("ignores other buttons and reminders without a day", async () => {
    await handlePiketPlanNotificationResponse(responseFor("approve", { day: "2026-10-23" }));
    await handlePiketPlanNotificationResponse(responseFor("piket_ya", {}));
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe("dismissPiketReminders", () => {
  beforeEach(() => mockDismiss.mockReset());

  it("dismisses only piket reminders", async () => {
    const presented = (id: string, type: string) => ({
      request: { identifier: id, content: { data: { type } } },
    });
    mockGetPresented.mockResolvedValue([
      presented("a", "piket_nudge"),
      presented("b", "piket_reminder"),
      presented("c", "piket"),
      presented("d", "rule"),
    ]);
    await dismissPiketReminders();
    expect(mockDismiss.mock.calls.map((c) => c[0])).toEqual(["a", "b"]);
  });
});

describe("piketPartnerActionFor", () => {
  it("maps the partner nudge buttons and ignores other taps", () => {
    expect(piketPartnerActionFor("piket_snooze")).toBe("snooze");
    expect(piketPartnerActionFor("piket_partner_malas")).toBe("malas");
    expect(piketPartnerActionFor("piket_malas")).toBeNull();
    expect(piketPartnerActionFor("expo.modules.notifications.actions.DEFAULT")).toBeNull();
  });
});
