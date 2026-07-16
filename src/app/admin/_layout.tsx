import { useMaterialColors } from "@expo/ui/jetpack-compose";
import { Stack, router } from "expo-router";
import { useEffect } from "react";
import { useAuth } from "../../utils/auth-context";

export default function AdminLayout() {
  const { user, loading } = useAuth();
  const colors = useMaterialColors();

  useEffect(() => {
    if (!loading && user?.role !== "admin") {
      router.replace("/(tabs)/dashboard" as any);
    }
  }, [loading, user]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: "slide_from_right",
        freezeOnBlur: true,
      }}
    />
  );
}
