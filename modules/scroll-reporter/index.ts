import {
  createModifier,
  createModifierWithEventListener,
  horizontalScroll,
  verticalScroll,
} from "@expo/ui/jetpack-compose/modifiers";
import { createViewModifierEventListener } from "@expo/ui/jetpack-compose/modifiers";
import { requireNativeView, requireOptionalNativeModule } from "expo";
import type { ModifierConfig } from "@expo/ui/jetpack-compose/modifiers";
import { createElement, type ReactNode } from "react";

export type ScrollDirection = "up" | "down";

/**
 * Modifiers this build's native module provides. Expo UI silently drops
 * modifiers it doesn't know, so each one is checked by name: an older build
 * (or one receiving this JS through an OTA update) falls back to plain
 * scrolling instead of losing it. Builds from before the list existed only
 * had `scrollReporter`.
 */
const native = requireOptionalNativeModule<{
  modifiers?: string[];
  views?: string[];
  setAppNightMode?: (mode: "system" | "light" | "dark") => void;
}>("ScrollReporter");
const supported = new Set(
  native ? (native.modifiers ?? ["scrollReporter"]) : [],
);
const supportedViews = new Set(native?.views ?? []);

/**
 * Drop-in replacement for `verticalScroll()` that also reports the scroll
 * direction. `onDirectionChange` fires only when the direction flips.
 * `enabled = false` stops scrolling (e.g. while dragging); builds from before
 * this option ignore it. Falls back to plain `verticalScroll()` when the
 * native modifier is missing.
 */
export const scrollReporter = (
  onDirectionChange: (direction: ScrollDirection) => void,
  enabled = true,
) =>
  supported.has("scrollReporter")
    ? createModifierWithEventListener(
        "scrollReporter",
        (event: { direction: ScrollDirection }) =>
          onDirectionChange(event.direction),
        { enabled },
      )
    : verticalScroll();

/**
 * `horizontalScroll()` that starts at the right edge: the row first shows its
 * last items and the user scrolls left for earlier ones. Falls back to plain
 * `horizontalScroll()` (starting at the left) when the modifier is missing.
 */
export const horizontalScrollFromEnd = () =>
  supported.has("horizontalScrollFromEnd")
    ? createModifier("horizontalScrollFromEnd")
    : horizontalScroll();

type TextScaleBoxProps = {
  /** Text size multiplier on top of the phone's own font size. */
  scale: number;
  modifiers?: ModifierConfig[];
  children?: ReactNode;
};

/** Whether this build can change the app's text size (needs the native view). */
export const textScaleSupported = supportedViews.has("TextScaleBox");

const NativeTextScaleBox = textScaleSupported
  ? requireNativeView<TextScaleBoxProps>("ScrollReporter", "TextScaleBox")
  : null;

/**
 * Scales all Compose text inside it by `scale`. Renders the children as-is
 * on a build without the native view (text stays at the phone's size).
 */
export const TextScaleBox = ({
  scale,
  modifiers,
  children,
}: TextScaleBoxProps) =>
  NativeTextScaleBox
    ? createElement(
        NativeTextScaleBox,
        {
          scale,
          modifiers,
          ...(modifiers
            ? createViewModifierEventListener(modifiers)
            : undefined),
        },
        children,
      )
    : children;

/**
 * Saves the app's light/dark mode with Android (12+) so the splash screen on
 * the next launch matches it. No-op on builds without the native function.
 */
export const setAppNightMode = (mode: "system" | "light" | "dark") =>
  native?.setAppNightMode?.(mode);
