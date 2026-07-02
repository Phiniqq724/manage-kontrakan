import { useEffect, useState } from "react";
import {
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { GhostButton, PageHeader, Rule, SectionHeader } from "../../components/UI";
import { Colors, FontSize, Spacing } from "../../constants/theme";
import { reportsApi, usersApi } from "../../services/api";
import type { Database } from "../../utils/supabase-types";

type ReportRow = Database["public"]["Tables"]["reports"]["Row"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];

export default function AdminReportsScreen() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [users, setUsers] = useState<Record<string, UserRow>>({});
  const [selected, setSelected] = useState<ReportRow | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [repRes, userRes] = await Promise.all([
      reportsApi.getAll(),
      usersApi.getAll(),
    ]);
    const userMap: Record<string, UserRow> = {};
    (userRes.data ?? []).forEach((u) => { userMap[u.id] = u; });
    setUsers(userMap);
    const sorted = (repRes.data ?? []).sort(
      (a, b) =>
        new Date(b.created_at ?? 0).getTime() -
        new Date(a.created_at ?? 0).getTime(),
    );
    setReports(sorted);
  }

  return (
    <View style={styles.container}>
      <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }}
              tintColor={Colors.accent}
            />
          }
        >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <PageHeader title="LAPORAN" subtitle="Semua laporan penghuni" />
        </View>

        <SectionHeader label={`${reports.length} Laporan`} />
        <Rule />

        {reports.length === 0 && (
          <Text style={styles.emptyText}>Belum ada laporan masuk.</Text>
        )}

        {reports.map((r) => {
          const reporter = r.created_by ? users[r.created_by] : null;
          const suspect = r.suspect ? users[r.suspect] : null;
          return (
            <TouchableOpacity
              key={r.id}
              style={styles.reportRow}
              onPress={() => setSelected(r)}
              activeOpacity={0.6}
            >
              <View style={styles.reportInfo}>
                <Text style={styles.reportTitle}>{r.title}</Text>
                <Text style={styles.reportMeta}>
                  Dilaporkan: {reporter?.fullname ?? "Unknown"} → {suspect?.fullname ?? "Unknown"}
                </Text>
                {r.created_at && (
                  <Text style={styles.reportDate}>
                    {new Date(r.created_at).toLocaleDateString("id-ID")}
                  </Text>
                )}
              </View>
              {r.docs && (
                <Ionicons name="attach-outline" size={16} color={Colors.textMuted} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Modal visible={!!selected} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            {selected && (
              <ScrollView>
                <Text style={styles.modalTitle}>{selected.title}</Text>
                <Text style={styles.modalSub}>
                  {users[selected.created_by ?? ""]?.fullname} melaporkan{" "}
                  {users[selected.suspect ?? ""]?.fullname}
                </Text>
                <Rule style={{ marginVertical: Spacing.md }} />
                {selected.description && (
                  <Text style={styles.modalDesc}>{selected.description}</Text>
                )}
                {selected.docs && (
                  <Image
                    source={{ uri: selected.docs }}
                    style={styles.evidenceImage}
                    resizeMode="contain"
                  />
                )}
                <View style={{ marginTop: Spacing.md }}>
                  <GhostButton label="TUTUP" onPress={() => setSelected(null)} />
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingBottom: Spacing.xl },
  headerRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  backBtn: { paddingLeft: Spacing.md, paddingTop: Spacing.lg },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  reportRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  reportInfo: { flex: 1 },
  reportTitle: { fontSize: FontSize.base, color: Colors.text },
  reportMeta: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  reportDate: { fontSize: FontSize.xs, color: Colors.textFaint, marginTop: 1 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(28,28,30,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: Colors.bg,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 40,
    maxHeight: "85%",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.lg,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  modalSub: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 4 },
  modalDesc: { fontSize: FontSize.base, color: Colors.text, lineHeight: 22, marginBottom: Spacing.md },
  evidenceImage: {
    width: "100%",
    height: 240,
    backgroundColor: Colors.surface,
    marginBottom: Spacing.md,
  },
});
