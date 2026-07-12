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
import {
  Badge,
  GhostButton,
  PageHeader,
  PrimaryButton,
  Rule,
  SectionHeader,
} from "../../components/UI";
import { Colors, FontSize, Spacing } from "../../constants/theme";
import { ruleRequestsApi, ruleRequestVotesApi, usersApi } from "../../services/api";
import { approveRuleRequest, declineRuleRequest } from "../../utils/rule-requests";
import type { Database } from "../../utils/supabase-types";

type RuleRequestRow = Database["public"]["Tables"]["rule_requests"]["Row"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];
type VoteTally = { approve_count: number; decline_count: number; total_votes: number };

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

export default function AdminRulesScreen() {
  const [requests, setRequests] = useState<RuleRequestRow[]>([]);
  const [users, setUsers] = useState<Record<string, UserRow>>({});
  const [tallies, setTallies] = useState<Record<string, VoteTally>>({});
  const [eligibleVoterCount, setEligibleVoterCount] = useState(0);
  const [processing, setProcessing] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [reqRes, userRes] = await Promise.all([
      ruleRequestsApi.getAll(),
      usersApi.getAll(),
    ]);
    const userMap: Record<string, UserRow> = {};
    (userRes.data ?? []).forEach((u) => {
      userMap[u.id] = u;
    });
    setUsers(userMap);
    setEligibleVoterCount((userRes.data ?? []).filter((u) => u.role !== "admin").length);

    const pending = (reqRes.data ?? []).filter((r) => r.status === "pending");
    setRequests(pending);

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

  async function handleApprove(req: RuleRequestRow) {
    setProcessing(req.id);
    try {
      await approveRuleRequest(req);
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessing(null);
    }
  }

  async function handleDecline(req: RuleRequestRow) {
    setProcessing(req.id);
    try {
      await declineRuleRequest(req);
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessing(null);
    }
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
          <PageHeader title="PERATURAN" subtitle="Tinjau usulan peraturan" />
        </View>

        <SectionHeader label={`${requests.length} Usulan Menunggu`} />
        <Rule />

        {requests.length === 0 && (
          <Text style={styles.emptyText}>
            Tidak ada usulan yang menunggu persetujuan.
          </Text>
        )}

        {requests.map((req) => {
          const proposer = req.assign_by ? users[req.assign_by] : null;
          const isProcessing = processing === req.id;
          const tally = tallies[req.id];
          return (
            <View key={req.id} style={styles.reqCard}>
              <View style={styles.reqHeader}>
                <Badge
                  label={PRIORITY_LABEL[req.priority] ?? req.priority}
                  type={PRIORITY_TYPE[req.priority] ?? "muted"}
                />
                <Text style={styles.reqProposer}>
                  {proposer?.fullname ?? "Unknown"}
                </Text>
              </View>
              <Text style={styles.reqRule}>{req.rules}</Text>
              {tally && (
                <Text style={styles.reqTally}>
                  {tally.approve_count} setuju · {tally.decline_count} tolak ·{" "}
                  {tally.total_votes}/{eligibleVoterCount} vote
                </Text>
              )}
              <View style={styles.reqActions}>
                <GhostButton
                  label={isProcessing ? "..." : "TOLAK"}
                  onPress={() => handleDecline(req)}
                />
                <View style={{ width: Spacing.sm }} />
                <PrimaryButton
                  label={isProcessing ? "MEMPROSES..." : "APPROVE"}
                  onPress={() => handleApprove(req)}
                />
              </View>
            </View>
          );
        })}
      </ScrollView>
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
  reqCard: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  reqHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reqProposer: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  reqRule: { fontSize: FontSize.base, color: Colors.text },
  reqTally: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  reqActions: { flexDirection: "row", marginTop: Spacing.xs },
});
