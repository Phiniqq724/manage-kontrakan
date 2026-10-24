import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import type { PrizeTier } from "./motm";

const { AndroidHaptics: A } = Haptics;

/** Mirrors the "Getar" setting; SettingsProvider keeps it in sync. */
let enabled = true;
export const setHapticsEnabled = (on: boolean) => {
  enabled = on;
};

/**
 * Plays an Android system haptic (short, crisp, follows the phone's own
 * touch-feedback setting), or the closest iOS equivalent. Fire-and-forget:
 * a failure just means no buzz.
 */
const play = (android: Haptics.AndroidHaptics, ios: () => Promise<void>) => {
  if (!enabled) return;
  const run =
    Platform.OS === "android" ? Haptics.performAndroidHapticsAsync(android) : ios();
  run.catch(() => {});
};

const light = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
const selection = () => Haptics.selectionAsync();

let lastTick = 0;

/** Named haptics so every screen feels the same. Only state changes and results buzz, never plain taps. */
export const haptics = {
  /** Switch or checkbox flipped. */
  toggle: (on: boolean) => play(on ? A.Toggle_On : A.Toggle_Off, light),
  /** Segmented button, filter chip or swiper page changed. */
  tick: () => play(A.Segment_Tick, selection),
  /** Each step of a slider. */
  step: () => play(A.Segment_Frequent_Tick, selection),
  /** Pull-to-refresh fired. */
  refresh: () => play(A.Gesture_End, light),
  dragStart: () => play(A.Drag_Start, light),
  drop: () => play(A.Gesture_End, light),
  shutter: () => play(A.Context_Click, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid)),
  /** The server accepted an action. */
  success: () =>
    play(A.Confirm, () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** An action failed or something was rejected. */
  error: () =>
    play(A.Reject, () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  /** Gacha reel passing a row; rate-limited so a fast spin doesn't turn into a buzz. */
  reelTick: () => {
    const now = Date.now();
    if (now - lastTick < 60) return;
    lastTick = now;
    play(A.Clock_Tick, selection);
  },
  /** Gacha landed: stronger for higher prize tiers. */
  win: (tier: PrizeTier) => {
    if (!enabled) return;
    if (tier === "normal") return haptics.success();
    const style =
      tier === "jackpot" ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium;
    Haptics.impactAsync(style).catch(() => {});
    if (tier === "jackpot") {
      setTimeout(() => {
        if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }, 180);
    }
  },
};
