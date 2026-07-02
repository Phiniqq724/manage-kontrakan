import { useEffect, useState } from "react";
import {
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import {
  Badge,
  Field,
  GhostButton,
  PageHeader,
  PrimaryButton,
  Rule,
  SectionHeader,
} from "../../components/UI";
import { Colors, FontSize, Spacing } from "../../constants/theme";
import { rulesApi, ruleRequestsApi } from "../../services/api";
import { useAuth } from "../../utils/auth-context";
import { getAdminToken, sendPushNotification } from "../../utils/notifications";
import type { Database } from "../../utils/supabase-types";

type RuleRow = Database["public"]["Tables"]["rules"]["Row"];
type RuleRequestRow = Database["public"]["Tables"]["rule_requests"]["Row"];

const PRIORITY_TYPE: Record<string, "danger" | "warning" | "muted"> = {
  high: "danger",
  medium: "warning",
  low: "muted",
};
const PRIORITY_LABEL: Record<string, string> = {
  high: "High",
  medium: "Med",
  low: "Low",
};

export default function RulesScreen() {
  const { user } = useAuth();
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [myRequests, setMyRequests] = useState<RuleRequestRow[]>([]);
  const [proposeModal, setProposeModal] = useState(false);
  const [ruleText, setRuleText] = useState("");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [user?.id]);

  async function loadData() {
    const [rulesRes, reqRes] = await Promise.all([
      rulesApi.getAll(),
      ruleRequestsApi.getAll(),
    ]);
    if (rulesRes.data) setRules(rulesRes.data);
    if (reqRes.data && user) {
      setMyRequests(reqRes.data.filter((r) => r.assign_by === user.id && r.status === "pending"));
    }
  }

  async function handlePropose() {
    if (!ruleText.trim()) {
      alert("Teks peraturan wajib diisi.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await ruleRequestsApi.create({
        rules: ruleText,
        priority,
        assign_by: user!.id,
        status: "pending",
      });
      if (error) throw error;
      setProposeModal(false);
      setRuleText("");
      setPriority("medium");
      loadData();
      const adminToken = await getAdminToken();
      if (adminToken) {
        await sendPushNotification(
          adminToken,
          "Usulan Peraturan Baru",
          `${user!.fullname} mengusulkan peraturan baru.`,
        );
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
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
        <PageHeader title="PERATURAN" subtitle="Tata tertib kontrakan" />

        <View style={{ paddingHorizontal: Spacing.md, marginBottom: Spacing.lg }}>
          <PrimaryButton label="USULKAN PERATURAN" onPress={() => setProposeModal(true)} />
        </View>

        {myRequests.length > 0 && (
          <View style={{ marginBottom: Spacing.lg }}>
            <SectionHeader label="Usulan Kamu" />
            <Rule />
            {myRequests.map((req) => (
              <View key={req.id} style={styles.ruleRow}>
                <Badge label="Menunggu" type="warning" />
                <Text style={styles.ruleText}>{req.rules}</Text>
              </View>
            ))}
            <Rule />
          </View>
        )}

        <SectionHeader label={`${rules.length} Peraturan Aktif`} />
        <Rule />
        {rules.length === 0 && (
          <Text style={styles.emptyText}>Belum ada peraturan aktif.</Text>
        )}
        {rules.map((r, i) => (
          <View key={r.id}>
            <View style={styles.ruleRow}>
              <Badge
                label={PRIORITY_LABEL[r.priority] ?? r.priority}
                type={PRIORITY_TYPE[r.priority] ?? "muted"}
              />
              <Text style={styles.ruleText}>{r.rules}</Text>
            </View>
            {i < rules.length - 1 && <Rule />}
          </View>
        ))}
        <Rule />
      </ScrollView>

      <Modal visible={proposeModal} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>USULKAN PERATURAN</Text>
            <Text style={styles.modalSub}>Admin akan meninjau usulan kamu</Text>
            <Rule style={{ marginVertical: Spacing.md }} />
            <Field
              label="Teks Peraturan"
              value={ruleText}
              onChangeText={setRuleText}
              placeholder="Tulis peraturan dengan jelas..."
              multiline
              numberOfLines={3}
            />
            <Text style={styles.pickLabel}>PRIORITAS</Text>
            <Rule />
            {(["high", "medium", "low"] as const).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.priorityOption, priority === p && styles.priorityOptionSelected]}
                onPress={() => setPriority(p)}
              >
                <Badge label={PRIORITY_LABEL[p]} type={PRIORITY_TYPE[p]} />
                <Text style={[styles.priorityText, priority === p && styles.priorityTextSelected]}>
                  {p === "high" ? "Penting & wajib" : p === "medium" ? "Perlu diperhatikan" : "Saran"}
                </Text>
              </TouchableOpacity>
            ))}
            <Rule />
            <View style={styles.modalActions}>
              <GhostButton label="BATAL" onPress={() => setProposeModal(false)} />
              <View style={{ width: Spacing.sm }} />
              <PrimaryButton
                label={submitting ? "MENGAJUKAN..." : "AJUKAN"}
                onPress={handlePropose}
              />
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingBottom: Spacing.xl },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  ruleText: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.text,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
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
  pickLabel: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
  },
  priorityOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  priorityOptionSelected: { backgroundColor: Colors.surface },
  priorityText: { fontSize: FontSize.base, color: Colors.textMuted },
  priorityTextSelected: { color: Colors.text },
  modalActions: { flexDirection: "row", marginTop: Spacing.md },
});
