import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { LoadingScreen } from "../components/LoadingScreen";
import { useAuth } from "../utils/auth-context";

const FINISH_HOLD_MS = 500;

export default function Index() {
  const { user, loading } = useAuth();
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    if (loading) return;
    // Hold the loader a moment once the session check resolves so the
    // progress bar can ease up to 100% instead of cutting off mid-animation.
    const timeout = setTimeout(() => setShowLoader(false), FINISH_HOLD_MS);
    return () => clearTimeout(timeout);
  }, [loading]);

  // Fonts are already loaded by the time this route mounts (RootLayout
  // gates on that first), so a session check in progress is the second of
  // two known boot milestones.
  if (showLoader) return <LoadingScreen progress={loading ? 0.5 : 1} />;

  if (!user) return <Redirect href="/auth/login" />;

  return <Redirect href="/(tabs)/dashboard" />;
}
