import { Stack, router } from "expo-router";
import { useEffect } from "react";
import { useAuth } from "../../utils/auth-context";
import { Colors } from "../../constants/theme";

export default function AdminLayout() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user?.role !== "admin") {
      router.replace("/(tabs)/dashboard" as any);
    }
  }, [loading, user]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.bg },
      }}
    />
  );
}
