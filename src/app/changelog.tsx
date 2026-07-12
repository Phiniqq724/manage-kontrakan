import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LogRow, PageHeader, Rule, SectionHeader } from "../components/UI";
import { Colors, FontSize, Spacing } from "../constants/theme";
import { changelogsApi } from "../services/api";
import type { Database } from "../utils/supabase-types";

type ChangelogRow = Database["public"]["Tables"]["changelogs"]["Row"];

export default function ChangelogScreen() {
  const [entries, setEntries] = useState<ChangelogRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data } = await changelogsApi.getAll();
    if (data) setEntries(data);
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
              await loadData();
              setRefreshing(false);
            }}
            tintColor={Colors.accent}
          />
        }
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <PageHeader title="CHANGELOG" subtitle="Riwayat pembaruan aplikasi" />
        </View>

        <SectionHeader label={`${entries.length} Pembaruan`} />
        <Rule />
        {entries.length === 0 && (
          <Text style={styles.emptyText}>Belum ada pembaruan.</Text>
        )}
        {entries.map((entry) => (
          <LogRow
            key={entry.id}
            date={new Date(entry.created_at).toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
            title={entry.title}
            meta={entry.description ?? undefined}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingBottom: Spacing.xl, paddingTop: Spacing.md },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  backBtn: { paddingLeft: Spacing.md, paddingTop: Spacing.lg },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
});
