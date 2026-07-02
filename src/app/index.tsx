import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { Colors } from "../constants/theme";
import { useAuth } from "../utils/auth-context";

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg }}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (!user) return <Redirect href="/auth/login" />;

  return <Redirect href="/(tabs)/dashboard" />;
}
