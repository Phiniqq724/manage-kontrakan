import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Colors, FontSize } from "../../constants/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  return (
    <Ionicons
      name={name}
      size={20}
      color={focused ? Colors.text : Colors.textFaint}
    />
  );
}

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text
      style={{
        fontFamily: "SpaceMono",
        fontSize: FontSize.xs,
        color: focused ? Colors.text : Colors.textFaint,
        letterSpacing: 0.5,
        marginTop: 2,
      }}
    >
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.text,
        tabBarInactiveTintColor: Colors.textFaint,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItem}>
              <TabIcon
                name={focused ? "grid" : "grid-outline"}
                focused={focused}
              />
              <TabLabel label="HOME" focused={focused} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="piket"
        options={{
          title: "Piket",
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItem}>
              <TabIcon
                name={focused ? "calendar" : "calendar-outline"}
                focused={focused}
              />
              <TabLabel label="PIKET" focused={focused} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="guests"
        options={{
          title: "Guests",
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItem}>
              <TabIcon
                name={focused ? "people" : "people-outline"}
                focused={focused}
              />
              <TabLabel label="TAMU" focused={focused} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="members"
        options={{
          title: "Members",
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItem}>
              <TabIcon
                name={focused ? "home" : "home-outline"}
                focused={focused}
              />
              <TabLabel label="PENGHUNI" focused={focused} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="rules"
        options={{
          title: "Rules",
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItem}>
              <TabIcon
                name={focused ? "document-text" : "document-text-outline"}
                focused={focused}
              />
              <TabLabel label="ATURAN" focused={focused} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItem}>
              <TabIcon
                name={focused ? "person-circle" : "person-circle-outline"}
                focused={focused}
              />
              <TabLabel label="PROFIL" focused={focused} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    height: 72,
    paddingBottom: 12,
    paddingTop: 12,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabItem: {
    alignItems: "center",
    width: 60,
    gap: 2,
  },
});
