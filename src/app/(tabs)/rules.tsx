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
import {
  ruleRequestsApi,
  ruleRequestVotesApi,
  rulesApi,
  usersApi,
} from "../../services/api";
import { useAuth } from "../../utils/auth-context";
import { getVoterTokensExcept, sendPushNotification } from "../../utils/notifications";
import { castVoteAndMaybeResolve } from "../../utils/rule-requests";
import type { Database } from "../../utils/supabase-types";

type RuleRow = Database["public"]["Tables"]["rules"]["Row"];
type RuleRequestRow = Database["public"]["Tables"]["rule_requests"]["Row"];
type VoteTally = { approve_count: number; decline_count: number; total_votes: number };
type VoteChoice = "approve" | "decline";

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
  const [pendingRequests, setPendingRequests] = useState<RuleRequestRow[]>([]);
  const [tallies, setTallies] = useState<Record<string, VoteTally>>({});
  const [myVotes, setMyVotes] = useState<Record<string, VoteChoice>>({});
  const [eligibleVoterCount, setEligibleVoterCount] = useState(0);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [proposeModal, setProposeModal] = useState(false);
  const [ruleText, setRuleText] = useState("");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [user?.id]);

  async function loadData() {
    const [rulesRes, reqRes, usersRes] = await Promise.all([
      rulesApi.getAll(),
      ruleRequestsApi.getAll(),
      usersApi.getAll(),
    ]);
    if (rulesRes.data) setRules(rulesRes.data);

    const nonAdminCount = (usersRes.data ?? []).filter((u) => u.role !== "admin").length;
    setEligibleVoterCount(nonAdminCount);

    if (reqRes.data && user) {
      const pending = reqRes.data.filter((r) => r.status === "pending");
      setPendingRequests(pending);

      // Admin doesn't vote — only acts via the admin approve/decline panel.
      if (user.role !== "admin") {
        const { data: myVoteRows } = await ruleRequestVotesApi.getAllMine(user.id);
        const voteMap: Record<string, VoteChoice> = {};
        (myVoteRows ?? []).forEach((v) => {
          voteMap[v.rule_request_id] = v.vote as VoteChoice;
        });
        setMyVotes(voteMap);
      } else {
        setMyVotes({});
      }

      const tallyEntries = await Promise.all(
        pending.map(async (r) => {
          const { data } = await ruleRequestVotesApi.getTally(r.id);
          return [r.id, data?.[0]] as const;
        }),
      );
      const tallyMap: Record<string, VoteTally> = {};
      tallyEntries.forEach(([id, tally]) => {
        if (tally) tallyMap[id] = tally;
      });
      setTallies(tallyMap);
    }
  }

  async function handleVote(req: RuleRequestRow, vote: VoteChoice) {
    if (!user) return;
    setVotingId(req.id);
    try {
      await castVoteAndMaybeResolve(req, user.id, vote, eligibleVoterCount);
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setVotingId(null);
    }
  }

  async function handlePropose() {
    if (!ruleText.trim()) {
      alert("Teks peraturan wajib diisi.");
      return;
    }
    setSubmitting(true);
    try {
      const { data: newRequest, error } = await ruleRequestsApi.create({
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

      if (newRequest) {
        const tokens = await getVoterTokensExcept(user!.id);
        await Promise.all(
          tokens.map((token) =>
            sendPushNotification(
              token,
              "Usulan Peraturan Baru",
              `${user!.fullname} mengusulkan peraturan baru. Yuk vote!`,
              { data: { ruleRequestId: newRequest.id }, categoryId: "rule_vote" },
            ),
          ),
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
        <PageHeader title="PERATURAN" subtitle="Tata tertib kontrakan" topInset={60} />

        <View style={{ paddingHorizontal: Spacing.md, marginBottom: Spacing.lg }}>
          <PrimaryButton label="USULKAN PERATURAN" onPress={() => setProposeModal(true)} />
        </View>

        {pendingRequests.length > 0 && (
          <View style={{ marginBottom: Spacing.lg }}>
            <SectionHeader label={`${pendingRequests.length} Sedang Di-vote`} />
            <Rule />
            {pendingRequests.map((req) => {
              const tally = tallies[req.id];
              const isVoting = votingId === req.id;
              const isAdmin = user?.role === "admin";
              const isOwn = req.assign_by === user?.id;
              const myVote = myVotes[req.id];
              const canVote = !isAdmin && !isOwn && !myVote;
              return (
                <View key={req.id} style={styles.voteCard}>
                  <View style={styles.voteHeader}>
                    <Badge
                      label={PRIORITY_LABEL[req.priority] ?? req.priority}
                      type={PRIORITY_TYPE[req.priority] ?? "muted"}
                    />
                    {tally && (
                      <Text style={styles.voteTally}>
                        {tally.approve_count} setuju · {tally.decline_count} tolak ·{" "}
                        {tally.total_votes}/{eligibleVoterCount} vote
                      </Text>
                    )}
                  </View>
                  <Text style={styles.ruleText}>{req.rules}</Text>
                  {canVote ? (
                    <View style={styles.voteActions}>
                      <GhostButton
                        label={isVoting ? "..." : "TOLAK"}
                        onPress={() => handleVote(req, "decline")}
                      />
                      <View style={{ width: Spacing.sm }} />
                      <PrimaryButton
                        label={isVoting ? "MEMPROSES..." : "TERIMA"}
                        onPress={() => handleVote(req, "approve")}
                      />
                    </View>
                  ) : (
                    !isAdmin && (
                      <Text style={styles.voteStatus}>
                        {isOwn
                          ? "Diajukan olehmu"
                          : myVote === "approve"
                            ? "Kamu vote: Setuju"
                            : "Kamu vote: Tolak"}
                      </Text>
                    )
                  )}
                </View>
              );
            })}
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
  voteCard: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  voteHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  voteTally: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  voteActions: { flexDirection: "row", marginTop: Spacing.xs },
  voteStatus: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.xs,
    color: Colors.textFaint,
    letterSpacing: 0.5,
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
