import { ButtonContent } from "@/components/ButtonContent";
import {
  ruleRequestsApi,
  ruleRequestVotesApi,
  rulesApi,
  usersApi,
} from "@/services/api";
import { useAuth } from "@/utils/auth-context";
import {
  getVoterTokensExcept,
  sendPushNotification,
} from "@/utils/notifications";
import { castVoteAndMaybeResolve } from "@/utils/rule-requests";
import type { Database } from "@/utils/supabase-types";
import Add from "@expo/material-symbols/add.xml";
import PriorityHigh from "@expo/material-symbols/priority_high.xml";
import { Host } from "@expo/ui";
import {
  AssistChip,
  Box,
  Button,
  Column,
  ExtendedFloatingActionButton,
  HorizontalDivider,
  Icon,
  ModalBottomSheet,
  OutlinedButton,
  OutlinedTextField,
  PullToRefreshBox,
  RadioButton,
  RNHostView,
  Row,
  Text,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import { Image } from "react-native";
import {
  align,
  background,
  clip,
  fillMaxHeight,
  fillMaxSize,
  fillMaxWidth,
  height,
  padding,
  paddingAll,
  selectable,
  Shapes,
  size,
  verticalScroll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useEffect, useState } from "react";

type RuleRow = Database["public"]["Tables"]["rules"]["Row"];
type RuleRequestRow = Database["public"]["Tables"]["rule_requests"]["Row"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];
type VoteTally = {
  approve_count: number;
  decline_count: number;
  total_votes: number;
};
type VoteChoice = "approve" | "decline";
type Priority = "high" | "medium" | "low";

const PRIORITY_LABEL: Record<string, string> = {
  high: "Prioritas tinggi",
  medium: "Sedang",
  low: "Saran",
};

function firstName(fullname: string) {
  return fullname.split(" ")[0] ?? fullname;
}

function VoterAvatar({ user, diameter }: { user: UserRow; diameter: number }) {
  const colors = useMaterialColors();
  const radius = diameter / 2;
  const ringSize = diameter + 4;

  const inner = user.avatar_url ? (
    <Box modifiers={[size(diameter, diameter), clip(Shapes.RoundedCorner(radius))]}>
      <RNHostView>
        <Image
          source={{ uri: user.avatar_url }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
        />
      </RNHostView>
    </Box>
  ) : (
    <Box
      contentAlignment="center"
      modifiers={[
        size(diameter, diameter),
        clip(Shapes.RoundedCorner(radius)),
        background(colors.primaryContainer),
      ]}
    >
      <Text style={{ typography: "labelSmall", fontWeight: "bold" }} color={colors.onPrimaryContainer}>
        {user.fullname[0]?.toUpperCase() ?? "?"}
      </Text>
    </Box>
  );

  // A background-colored ring keeps overlapping circles visually distinct —
  // the `border` modifier always draws a rectangle regardless of `clip()`,
  // so it can't be used to outline a circular avatar.
  return (
    <Box
      contentAlignment="center"
      modifiers={[
        size(ringSize, ringSize),
        clip(Shapes.RoundedCorner(ringSize / 2)),
        background(colors.background),
      ]}
    >
      {inner}
    </Box>
  );
}

export default function RulesScreen() {
  const { user } = useAuth();
  const colors = useMaterialColors();

  const [rules, setRules] = useState<RuleRow[]>([]);
  const [users, setUsers] = useState<Record<string, UserRow>>({});
  const [pendingRequests, setPendingRequests] = useState<RuleRequestRow[]>([]);
  const [tallies, setTallies] = useState<Record<string, VoteTally>>({});
  const [voterIds, setVoterIds] = useState<Record<string, string[]>>({});
  const [myVotes, setMyVotes] = useState<Record<string, VoteChoice>>({});
  const [eligibleVoterCount, setEligibleVoterCount] = useState(0);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [proposeOpen, setProposeOpen] = useState(false);
  const [ruleText, setRuleText] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [user?.id]);

  function priorityColor(p: string) {
    if (p === "high")
      return {
        bg: colors.errorContainer,
        fg: colors.onErrorContainer,
        dot: colors.error,
      };
    if (p === "medium")
      return {
        bg: colors.tertiaryContainer,
        fg: colors.onTertiaryContainer,
        dot: colors.tertiary,
      };
    return {
      bg: colors.surfaceContainerHigh,
      fg: colors.onSurfaceVariant,
      dot: colors.onSurfaceVariant,
    };
  }

  async function loadData() {
    const [rulesRes, reqRes, usersRes] = await Promise.all([
      rulesApi.getAll(),
      ruleRequestsApi.getAll(),
      usersApi.getAll(),
    ]);
    if (rulesRes.data) setRules(rulesRes.data);

    const userMap: Record<string, UserRow> = {};
    (usersRes.data ?? []).forEach((u) => {
      userMap[u.id] = u;
    });
    setUsers(userMap);

    const nonAdmin = (usersRes.data ?? []).filter((u) => u.role !== "admin");
    setEligibleVoterCount(nonAdmin.length);

    if (reqRes.data && user) {
      const pending = reqRes.data.filter((r) => r.status === "pending");
      setPendingRequests(pending);

      if (user.role !== "admin") {
        const { data: myVoteRows } = await ruleRequestVotesApi.getAllMine(
          user.id,
        );
        const voteMap: Record<string, VoteChoice> = {};
        (myVoteRows ?? []).forEach((v) => {
          voteMap[v.rule_request_id] = v.vote as VoteChoice;
        });
        setMyVotes(voteMap);
      } else {
        setMyVotes({});
      }

      const entries = await Promise.all(
        pending.map(async (r) => {
          const [{ data: tally }, { data: voteRows }] = await Promise.all([
            ruleRequestVotesApi.getTally(r.id),
            ruleRequestVotesApi.getVoters(r.id),
          ]);
          return [r.id, tally?.[0], voteRows ?? []] as const;
        }),
      );
      const tallyMap: Record<string, VoteTally> = {};
      const votersMap: Record<string, string[]> = {};
      entries.forEach(([id, tally, voteRows]) => {
        if (tally) tallyMap[id] = tally;
        votersMap[id] = voteRows.map((v: { voter_id: string }) => v.voter_id);
      });
      setTallies(tallyMap);
      setVoterIds(votersMap);
    }
  }

  const onRefresh = () => {
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  };

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
      setProposeOpen(false);
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
              {
                data: { ruleRequestId: newRequest.id },
                categoryId: "rule_vote",
              },
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

  const nonAdminUsers = Object.values(users).filter((u) => u.role !== "admin");

  return (
    <Host style={{ flex: 1 }}>
      <Box modifiers={[fillMaxSize()]}>
        <PullToRefreshBox
          isRefreshing={refreshing}
          onRefresh={onRefresh}
          contentAlignment="topCenter"
          modifiers={[fillMaxSize(), background(colors.background)]}
        >
          <Column
            verticalArrangement={{ spacedBy: 24 }}
            modifiers={[
              fillMaxSize(),
              verticalScroll(),
              padding(16, 56, 16, 100),
            ]}
          >
            <Text
              style={{ typography: "headlineMedium", fontWeight: "bold" }}
              color={colors.onBackground}
            >
              Aturan
            </Text>

            {pendingRequests.length > 0 && (
              <Column verticalArrangement={{ spacedBy: 12 }}>
                <Text
                  style={{
                    typography: "labelLarge",
                    fontWeight: "bold",
                    letterSpacing: 0.5,
                  }}
                  color={colors.onSurfaceVariant}
                >
                  {`SEDANG DI-VOTE · ${pendingRequests.length}`}
                </Text>
                {pendingRequests.map((req) => {
                  const tally = tallies[req.id] ?? {
                    approve_count: 0,
                    decline_count: 0,
                    total_votes: 0,
                  };
                  const isVoting = votingId === req.id;
                  const isAdmin = user?.role === "admin";
                  const isOwn = req.assign_by === user?.id;
                  const myVote = myVotes[req.id];
                  const canVote = !isAdmin && !isOwn && !myVote;
                  const pc = priorityColor(req.priority);

                  const votedIdSet = new Set(voterIds[req.id] ?? []);
                  const votedUsers = nonAdminUsers.filter((u) =>
                    votedIdSet.has(u.id),
                  );
                  const nonVoters = nonAdminUsers.filter(
                    (u) => !votedIdSet.has(u.id),
                  );
                  const remaining = Math.max(
                    0,
                    eligibleVoterCount - tally.total_votes,
                  );

                  return (
                    <Box
                      key={req.id}
                      modifiers={[
                        fillMaxWidth(),
                        clip(Shapes.RoundedCorner(20)),
                        background(colors.surfaceContainerLow),
                      ]}
                    >
                      <Column
                        verticalArrangement={{ spacedBy: 12 }}
                        modifiers={[paddingAll(16)]}
                      >
                        <Row
                          verticalAlignment="center"
                          horizontalArrangement="spaceBetween"
                          modifiers={[fillMaxWidth()]}
                        >
                          <AssistChip
                            colors={{
                              containerColor: pc.bg,
                              labelColor: pc.fg,
                            }}
                          >
                            {req.priority === "high" && (
                              <AssistChip.LeadingIcon>
                                <Icon
                                  source={PriorityHigh}
                                  tint={pc.fg}
                                  size={14}
                                />
                              </AssistChip.LeadingIcon>
                            )}
                            <AssistChip.Label>
                              <Text
                                style={{
                                  typography: "labelSmall",
                                  fontWeight: "bold",
                                }}
                                color={pc.fg}
                              >
                                {PRIORITY_LABEL[req.priority] ?? req.priority}
                              </Text>
                            </AssistChip.Label>
                          </AssistChip>
                          <Text
                            style={{ typography: "labelMedium" }}
                            color={colors.onSurfaceVariant}
                          >
                            {`Diusulkan ${firstName(users[req.assign_by ?? ""]?.fullname ?? "Seseorang")}`}
                          </Text>
                        </Row>

                        <Text
                          style={{
                            typography: "bodyLarge",
                            fontWeight: "600",
                          }}
                          color={colors.onSurface}
                        >
                          {`"${req.rules}"`}
                        </Text>

                        <Row
                          modifiers={[
                            fillMaxWidth(),
                            height(6),
                            clip(Shapes.RoundedCorner(3)),
                            background(colors.surfaceContainerHighest),
                          ]}
                        >
                          {tally.approve_count > 0 && (
                            <Box
                              modifiers={[
                                weight(tally.approve_count),
                                fillMaxHeight(),
                                background(colors.primary),
                              ]}
                            />
                          )}
                          {tally.decline_count > 0 && (
                            <Box
                              modifiers={[
                                weight(tally.decline_count),
                                fillMaxHeight(),
                                background(colors.error),
                              ]}
                            />
                          )}
                          {remaining > 0 && (
                            <Box
                              modifiers={[weight(remaining), fillMaxHeight()]}
                            />
                          )}
                        </Row>

                        <Row
                          horizontalArrangement="spaceBetween"
                          verticalAlignment="center"
                          modifiers={[fillMaxWidth()]}
                        >
                          <Text
                            style={{ typography: "labelMedium" }}
                            color={colors.onSurfaceVariant}
                          >
                            {`${tally.approve_count} setuju · ${tally.decline_count} tolak`}
                          </Text>
                          <Text
                            style={{ typography: "labelMedium" }}
                            color={colors.onSurfaceVariant}
                          >
                            {`${tally.total_votes}/${eligibleVoterCount} sudah vote`}
                          </Text>
                        </Row>

                        {votedUsers.length > 0 && (
                          <Row
                            verticalAlignment="center"
                            horizontalArrangement={{ spacedBy: 6 }}
                          >
                            <Row horizontalArrangement={{ spacedBy: -8 }}>
                              {votedUsers.slice(0, 4).map((v) => (
                                <VoterAvatar key={v.id} user={v} diameter={24} />
                              ))}
                            </Row>
                            {remaining > 0 && (
                              <Text
                                style={{ typography: "labelMedium" }}
                                color={colors.onSurfaceVariant}
                              >
                                {remaining === 1 && nonVoters.length === 1
                                  ? `menunggu ${firstName(nonVoters[0].fullname)}`
                                  : `menunggu ${remaining} orang lagi`}
                              </Text>
                            )}
                          </Row>
                        )}

                        {canVote ? (
                          <Row
                            verticalAlignment="center"
                            horizontalArrangement={{ spacedBy: 12 }}
                            modifiers={[fillMaxWidth()]}
                          >
                            <OutlinedButton
                              enabled={!isVoting}
                              onClick={() => handleVote(req, "decline")}
                              modifiers={[weight(1)]}
                            >
                              <Text
                                style={{ typography: "labelLarge" }}
                                color={colors.primary}
                              >
                                Tolak
                              </Text>
                            </OutlinedButton>
                            <Button
                              enabled={!isVoting}
                              onClick={() => handleVote(req, "approve")}
                              modifiers={[weight(1)]}
                            >
                              <Text
                                style={{
                                  typography: "labelLarge",
                                  fontWeight: "bold",
                                }}
                                color={colors.onPrimary}
                              >
                                Setuju
                              </Text>
                            </Button>
                          </Row>
                        ) : (
                          !isAdmin && (
                            <Text
                              style={{ typography: "labelMedium" }}
                              color={colors.onSurfaceVariant}
                            >
                              {isOwn
                                ? "Diajukan olehmu"
                                : myVote === "approve"
                                  ? "Kamu vote: Setuju"
                                  : "Kamu vote: Tolak"}
                            </Text>
                          )
                        )}
                      </Column>
                    </Box>
                  );
                })}
              </Column>
            )}

            <Column verticalArrangement={{ spacedBy: 4 }}>
              <Text
                style={{
                  typography: "labelLarge",
                  fontWeight: "bold",
                  letterSpacing: 0.5,
                }}
                color={colors.onSurfaceVariant}
              >
                {`ATURAN AKTIF · ${rules.length}`}
              </Text>
              {rules.length === 0 && (
                <Text
                  style={{ typography: "bodyMedium" }}
                  color={colors.onSurfaceVariant}
                >
                  Belum ada peraturan aktif.
                </Text>
              )}
              {rules.map((r, i) => {
                const pc = priorityColor(r.priority);
                return (
                  <Column key={r.id}>
                    <Row
                      verticalAlignment="center"
                      horizontalArrangement={{ spacedBy: 12 }}
                      modifiers={[padding(0, 12, 0, 12)]}
                    >
                      <Box
                        modifiers={[
                          size(8, 8),
                          clip(Shapes.Circle),
                          background(pc.dot),
                        ]}
                      />
                      <Column
                        verticalArrangement={{ spacedBy: 2 }}
                        modifiers={[weight(1)]}
                      >
                        <Text
                          style={{ typography: "bodyMedium" }}
                          color={colors.onSurface}
                        >
                          {r.rules}
                        </Text>
                        <Text
                          style={{ typography: "labelMedium" }}
                          color={colors.onSurfaceVariant}
                        >
                          {PRIORITY_LABEL[r.priority] ?? r.priority}
                        </Text>
                      </Column>
                    </Row>
                    {i < rules.length - 1 && (
                      <HorizontalDivider color={colors.outlineVariant} />
                    )}
                  </Column>
                );
              })}
            </Column>
          </Column>
        </PullToRefreshBox>

        <ExtendedFloatingActionButton
          onClick={() => setProposeOpen(true)}
          modifiers={[align("bottomEnd"), padding(0, 0, 20, 24)]}
        >
          <ExtendedFloatingActionButton.Icon>
            <Icon source={Add} size={20} />
          </ExtendedFloatingActionButton.Icon>
          <ExtendedFloatingActionButton.Text>
            <Text style={{ typography: "labelLarge", fontWeight: "bold" }}>
              Usulkan
            </Text>
          </ExtendedFloatingActionButton.Text>
        </ExtendedFloatingActionButton>
      </Box>

      {proposeOpen && (
        <ModalBottomSheet onDismissRequest={() => setProposeOpen(false)}>
          <Column
            verticalArrangement={{ spacedBy: 16 }}
            modifiers={[
              fillMaxWidth(),
              verticalScroll(),
              padding(24, 8, 24, 32),
            ]}
          >
            <Column verticalArrangement={{ spacedBy: 4 }}>
              <Text
                style={{ typography: "headlineSmall", fontWeight: "bold" }}
                color={colors.onSurface}
              >
                Usulkan peraturan
              </Text>
              <Text
                style={{ typography: "bodyMedium" }}
                color={colors.onSurfaceVariant}
              >
                Admin akan meninjau usulan kamu.
              </Text>
            </Column>

            <OutlinedTextField
              onValueChange={setRuleText}
              minLines={3}
              keyboardOptions={{ capitalization: "sentences" }}
              modifiers={[fillMaxWidth()]}
            >
              <OutlinedTextField.Label>
                <Text>Teks peraturan</Text>
              </OutlinedTextField.Label>
            </OutlinedTextField>

            <Column verticalArrangement={{ spacedBy: 4 }}>
              <Text
                style={{ typography: "labelLarge", fontWeight: "bold" }}
                color={colors.onSurfaceVariant}
              >
                Prioritas
              </Text>
              {(["high", "medium", "low"] as const).map((p) => {
                return (
                  <Row
                    key={p}
                    verticalAlignment="center"
                    horizontalArrangement={{ spacedBy: 8 }}
                    modifiers={[
                      clip(Shapes.RoundedCorner(12)),
                      selectable(
                        priority === p,
                        () => setPriority(p),
                        "radioButton",
                      ),
                      padding(4, 8, 4, 8),
                      fillMaxWidth(),
                    ]}
                  >
                    <RadioButton selected={priority === p} />
                    <Column>
                      <Text
                        style={{ typography: "bodyLarge" }}
                        color={colors.onSurface}
                      >
                        {PRIORITY_LABEL[p]}
                      </Text>
                      <Text
                        style={{ typography: "bodySmall" }}
                        color={colors.onSurfaceVariant}
                      >
                        {p === "high"
                          ? "Penting & wajib"
                          : p === "medium"
                            ? "Perlu diperhatikan"
                            : "Saran"}
                      </Text>
                    </Column>
                  </Row>
                );
              })}
            </Column>

            <Row
              verticalAlignment="center"
              horizontalArrangement={{ spacedBy: 12 }}
              modifiers={[fillMaxWidth()]}
            >
              <OutlinedButton
                onClick={() => setProposeOpen(false)}
                modifiers={[weight(1)]}
              >
                <Text
                  style={{ typography: "labelLarge" }}
                  color={colors.primary}
                >
                  Batal
                </Text>
              </OutlinedButton>
              <Button
                enabled={!submitting}
                onClick={handlePropose}
                modifiers={[weight(1)]}
              >
                <ButtonContent loading={submitting} label="Ajukan" color={colors.onPrimary} />
              </Button>
            </Row>
          </Column>
        </ModalBottomSheet>
      )}
    </Host>
  );
}
