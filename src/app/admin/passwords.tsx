import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { GhostButton, PageHeader, Rule } from "../../components/UI";
import { Colors, FontSize, Spacing } from "../../constants/theme";
import { usersApi } from "../../services/api";
import { supabase } from "../../utils/supabase";
import type { Database } from "../../utils/supabase-types";

type UserRow = Database["public"]["Tables"]["users"]["Row"];

const DEFAULT_PASSWORD = "Kontrakan123!";

export default function AdminPasswordsScreen() {
  const [members, setMembers] = useState<UserRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [resetting, setResetting] = useState<string | null>(null);

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    const { data } = await usersApi.getAll();
    setMembers((data ?? []).filter((u) => u.role !== "admin"));
  }

  async function handleReset(u: UserRow) {
    Alert.alert(
      "Reset Password",
      `Reset password ${u.fullname} ke default?\n\nPassword default: ${DEFAULT_PASSWORD}`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            setResetting(u.id);
            try {
              const { data, error } = await supabase.functions.invoke("reset-password", {
                body: { userId: u.id },
              });
              if (error) throw error;
              if (data?.error) throw new Error(data.error);
              Alert.alert("Berhasil", `Password ${u.fullname} berhasil direset ke default.`);
            } catch (err: any) {
              Alert.alert("Error", err.message);
            } finally {
              setResetting(null);
            }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await loadMembers();
              setRefreshing(false);
            }}
            tintColor={Colors.accent}
          />
        }
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <PageHeader title="PASSWORD MANAGER" subtitle="Reset password penghuni ke default" />
        </View>

        <View style={styles.noticeBox}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.noticeText}>
            Password default: <Text style={styles.noticeBold}>{DEFAULT_PASSWORD}</Text>
          </Text>
        </View>

        <Rule />

        {members.map((u) => (
          <View key={u.id}>
            <View style={styles.memberRow}>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{u.fullname}</Text>
                <Text style={styles.memberMeta}>{u.username} · {u.email}</Text>
              </View>
              <GhostButton
                label={resetting === u.id ? "..." : "RESET"}
                onPress={() => handleReset(u)}
              />
            </View>
            <Rule />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingBottom: Spacing.xl },
  headerRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  backBtn: { paddingLeft: Spacing.md, paddingTop: Spacing.lg },
  noticeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  noticeText: { fontSize: FontSize.sm, color: Colors.textMuted, flex: 1 },
  noticeBold: { fontFamily: "SpaceMono", color: Colors.text },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  memberInfo: { flex: 1 },
  memberName: { fontSize: FontSize.base, color: Colors.text },
  memberMeta: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
});
