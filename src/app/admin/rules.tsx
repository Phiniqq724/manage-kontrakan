import { ButtonContent } from "@/components/ButtonContent";
import { ruleRequestsApi, ruleRequestVotesApi, usersApi } from "@/services/api";
import { approveRuleRequest, declineRuleRequest } from "@/utils/rule-requests";
import type { Database } from "@/utils/supabase-types";
import ArrowBack from "@expo/material-symbols/arrow_back.xml";
import { Host } from "@expo/ui";
import {
  Button,
  Card,
  Column,
  Icon,
  IconButton,
  OutlinedButton,
  PullToRefreshBox,
  Row,
  Text,
  useMaterialColors,
  type MaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  background,
  clip,
  fillMaxSize,
  fillMaxWidth,
  padding,
  paddingAll,
  Shapes,
  verticalScroll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { router } from "expo-router";
import { useEffect, useState } from "react";

type RuleRequestRow = Database["public"]["Tables"]["rule_requests"]["Row"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];
type VoteTally = {
  approve_count: number;
  decline_count: number;
  total_votes: number;
};

const PRIORITY_LABEL: Record<string, string> = {
  high: "High",
  medium: "Med",
  low: "Low",
};

function priorityColor(priority: string, colors: MaterialColors) {
  switch (priority) {
    case "high":
      return { bg: colors.errorContainer, fg: colors.onErrorContainer };
    case "medium":
      return { bg: colors.tertiaryContainer, fg: colors.onTertiaryContainer };
    default:
      return {
        bg: colors.surfaceContainerHighest,
        fg: colors.onSurfaceVariant,
      };
  }
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors = useMaterialColors();
  const { bg, fg } = priorityColor(priority, colors);
  return (
    <Row
      modifiers={[
        clip(Shapes.RoundedCorner(8)),
        background(bg),
        padding(8, 4, 8, 4),
      ]}
    >
      <Text style={{ typography: "labelSmall", fontWeight: "bold" }} color={fg}>
        {PRIORITY_LABEL[priority] ?? priority}
      </Text>
    </Row>
  );
}

export default function AdminRulesScreen() {
  const colors = useMaterialColors();
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
    setEligibleVoterCount(
      (userRes.data ?? []).filter((u) => u.role !== "admin").length,
    );

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

  const onRefresh = () => {
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  };

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
    <Host style={{ flex: 1 }}>
      <PullToRefreshBox
        isRefreshing={refreshing}
        onRefresh={onRefresh}
        contentAlignment="topCenter"
        modifiers={[fillMaxSize(), background(colors.background)]}
      >
        <Column
          verticalArrangement={{ spacedBy: 16 }}
          modifiers={[fillMaxSize(), verticalScroll(), padding(16, 56, 16, 32)]}
        >
          <Row
            verticalAlignment="center"
            horizontalArrangement={{ spacedBy: 4 }}
            modifiers={[fillMaxWidth()]}
          >
            <IconButton onClick={() => router.back()}>
              <Icon source={ArrowBack} tint={colors.onSurface} size={22} />
            </IconButton>
            <Column
              verticalArrangement={{ spacedBy: 2 }}
              modifiers={[weight(1)]}
            >
              <Text
                style={{ typography: "titleLarge", fontWeight: "bold" }}
                color={colors.onBackground}
              >
                Peraturan
              </Text>
              <Text
                style={{ typography: "bodySmall" }}
                color={colors.onSurfaceVariant}
              >
                Tinjau usulan peraturan
              </Text>
            </Column>
          </Row>

          <Text
            style={{ typography: "labelLarge", fontWeight: "bold" }}
            color={colors.onSurfaceVariant}
          >
            {`${requests.length} usulan menunggu`}
          </Text>

          {requests.length === 0 && (
            <Text
              style={{ typography: "bodyMedium" }}
              color={colors.onSurfaceVariant}
            >
              Tidak ada usulan yang menunggu persetujuan.
            </Text>
          )}

          {requests.map((req) => {
            const proposer = req.assign_by ? users[req.assign_by] : null;
            const isProcessing = processing === req.id;
            const tally = tallies[req.id];
            return (
              <Card
                key={req.id}
                colors={{ containerColor: colors.surfaceContainerLow }}
                modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(18))]}
              >
                <Column
                  verticalArrangement={{ spacedBy: 8 }}
                  modifiers={[paddingAll(16)]}
                >
                  <Row
                    verticalAlignment="center"
                    horizontalArrangement="spaceBetween"
                    modifiers={[fillMaxWidth()]}
                  >
                    <PriorityBadge priority={req.priority} />
                    <Text
                      style={{ typography: "labelSmall", fontWeight: "bold" }}
                      color={colors.onSurfaceVariant}
                    >
                      {proposer?.fullname ?? "Unknown"}
                    </Text>
                  </Row>
                  <Text
                    style={{ typography: "bodyLarge" }}
                    color={colors.onSurface}
                  >
                    {req.rules}
                  </Text>
                  {tally && (
                    <Text
                      style={{ typography: "labelSmall" }}
                      color={colors.onSurfaceVariant}
                    >
                      {`${tally.approve_count} setuju · ${tally.decline_count} tolak · ${tally.total_votes}/${eligibleVoterCount} vote`}
                    </Text>
                  )}
                  <Row
                    verticalAlignment="center"
                    horizontalArrangement={{ spacedBy: 12 }}
                    modifiers={[fillMaxWidth()]}
                  >
                    <OutlinedButton
                      enabled={!isProcessing}
                      onClick={() => handleDecline(req)}
                      modifiers={[weight(1)]}
                    >
                      <Text
                        style={{ typography: "labelLarge" }}
                        color={colors.error}
                      >
                        Tolak
                      </Text>
                    </OutlinedButton>
                    <Button
                      enabled={!isProcessing}
                      onClick={() => handleApprove(req)}
                      modifiers={[weight(1)]}
                    >
                      <ButtonContent loading={isProcessing} label="Approve" color={colors.onPrimary} />
                    </Button>
                  </Row>
                </Column>
              </Card>
            );
          })}
        </Column>
      </PullToRefreshBox>
    </Host>
  );
}
