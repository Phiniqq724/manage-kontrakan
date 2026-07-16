import { Tabs } from "expo-router/js-tabs";
import { AppTabBar } from "@/components/AppTabBar";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Beranda" }} />
      <Tabs.Screen name="piket" options={{ title: "Piket" }} />
      <Tabs.Screen name="guests" options={{ title: "Tamu" }} />
      <Tabs.Screen name="rules" options={{ title: "Aturan" }} />
      <Tabs.Screen name="members" options={{ title: "Penghuni" }} />
    </Tabs>
  );
}
