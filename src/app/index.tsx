import { Redirect } from "expo-router";
import { useAuth } from "../utils/auth-context";

export default function Index() {
  const { user, loading } = useAuth();

  // The native splash covers this until the session check finishes.
  if (loading) return null;

  if (!user) return <Redirect href="/auth/login" />;

  return <Redirect href="/(tabs)/dashboard" />;
}
