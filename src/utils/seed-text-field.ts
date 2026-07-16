import type { TextFieldRef } from "@expo/ui/jetpack-compose";
import type { RefObject } from "react";

/**
 * Imperatively seeds an uncontrolled OutlinedTextField's initial value.
 * `setText` can reject if the native view hasn't registered with the
 * bridge yet on the same tick the ref first attaches, so this retries
 * briefly instead of silently leaving the field empty.
 */
export async function seedTextField(
  ref: RefObject<TextFieldRef | null>,
  value: string,
  attempts = 5,
) {
  for (let i = 0; i < attempts; i++) {
    if (ref.current) {
      try {
        await ref.current.setText(value);
        return;
      } catch {
        // Native view not registered yet — retry below.
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
