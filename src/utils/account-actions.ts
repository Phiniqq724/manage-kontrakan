import { useAuth } from "@/utils/auth-context";
import { smartSignOut, switchToLinkedAccount } from "@/utils/multi-session";
import { router } from "expo-router";

/**
 * Log out and switch-account actions shared by the profile page and the
 * profile menu. Both refresh the auth user explicitly: restoring a stored
 * session doesn't always fire the SIGNED_IN event AuthProvider listens for.
 */
export const useAccountActions = () => {
  const { user, refresh } = useAuth();

  /** Logs out; falls back to the linked account when one is stored on this phone. */
  const logout = async () => {
    if (!user) return;
    const switchedToFallback = await smartSignOut(user.id);
    if (switchedToFallback) await refresh();
    router.replace(switchedToFallback ? "/(tabs)/dashboard" : "/auth/login");
  };

  /** Swaps to the linked account stored on this phone. Throws on failure. */
  const switchAccount = async () => {
    if (!user) return;
    await switchToLinkedAccount({
      id: user.id,
      fullname: user.fullname,
      email: user.email,
    });
    await refresh();
    router.replace("/(tabs)/dashboard");
  };

  return { logout, switchAccount };
};
