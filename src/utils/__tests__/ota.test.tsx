/// <reference types="jest" />

const mockCheck = jest.fn();
const mockFetch = jest.fn();
jest.mock("expo-updates", () => ({
  isEnabled: true,
  checkForUpdateAsync: () => mockCheck(),
  fetchUpdateAsync: () => mockFetch(),
  reloadAsync: jest.fn(),
}));

import { AppState } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import {
  AUTO_CHECK_GAP_MS,
  fetchLatestUpdate,
  shouldAutoCheck,
  useAutoUpdateCheck,
} from "@/utils/ota";

let appStateListener: ((state: string) => void) | null = null;
jest.spyOn(AppState, "addEventListener").mockImplementation(((_: string, fn: (state: string) => void) => {
  appStateListener = fn;
  return { remove: () => (appStateListener = null) };
}) as any);

const render = () => {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<Probe />);
  });
  return r;
};

const Probe = () => {
  useAutoUpdateCheck();
  return null;
};

beforeEach(() => {
  mockCheck.mockReset().mockResolvedValue({ isAvailable: false });
  mockFetch.mockReset().mockResolvedValue({ isNew: true });
  (globalThis as any).__DEV__ = false;
});

describe("shouldAutoCheck", () => {
  it("waits for the gap between checks", () => {
    expect(shouldAutoCheck(0, 1000)).toBe(false);
    expect(shouldAutoCheck(0, AUTO_CHECK_GAP_MS)).toBe(true);
    expect(shouldAutoCheck(1000, 1000 + AUTO_CHECK_GAP_MS - 1)).toBe(false);
  });
});

describe("fetchLatestUpdate", () => {
  it("reports latest without downloading when nothing is new", async () => {
    await expect(fetchLatestUpdate()).resolves.toBe("latest");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("downloads an available update", async () => {
    mockCheck.mockResolvedValue({ isAvailable: true });
    await expect(fetchLatestUpdate()).resolves.toBe("downloaded");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("useAutoUpdateCheck", () => {
  it("checks on mount and again on foreground after the gap", () => {
    jest.useFakeTimers({ now: AUTO_CHECK_GAP_MS * 10 });
    const r = render();
    expect(mockCheck).toHaveBeenCalledTimes(1);

    act(() => appStateListener?.("active"));
    expect(mockCheck).toHaveBeenCalledTimes(1);

    jest.setSystemTime(Date.now() + AUTO_CHECK_GAP_MS);
    act(() => appStateListener?.("background"));
    act(() => appStateListener?.("active"));
    expect(mockCheck).toHaveBeenCalledTimes(2);

    act(() => r.unmount());
    expect(appStateListener).toBeNull();
    jest.useRealTimers();
  });

  it("does nothing in dev builds", () => {
    (globalThis as any).__DEV__ = true;
    render();
    expect(mockCheck).not.toHaveBeenCalled();
  });
});
