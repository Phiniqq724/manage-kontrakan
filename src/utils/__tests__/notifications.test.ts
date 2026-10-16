/// <reference types="jest" />

const mockGetSession = jest.fn();
const mockUpsert = jest.fn();

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
  AndroidImportance: { MAX: 5 },
}));
jest.mock("@/utils/supabase", () => ({
  supabase: {
    auth: { getSession: () => mockGetSession() },
    from: () => ({ upsert: (...args: unknown[]) => mockUpsert(...args) }),
  },
}));

import { registerForPushNotifications } from "@/utils/notifications";

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
