import { haptics } from "@/utils/haptics";
import { AppHost, useAppColors } from "@/components/AppHost";
import { ButtonContent } from "@/components/ButtonContent";
import { FormField } from "@/components/FormField";
import { FormSheet, SheetActions } from "@/components/FormSheet";
import { VoterAvatar } from "@/components/VoterAvatar";
import { ChipRow, EmptyState, IconText, SectionLabel } from "@/components/ListBits";
import {
  ruleRequestsApi,
  ruleRequestVotesApi,
  rulesApi,
  usersApi,
} from "@/services/api";
import { useAuth } from "@/utils/auth-context";
import { cooldownRemaining, formatCooldown } from "@/utils/cooldown";
import { sendPush } from "@/utils/notifications";
import { castVoteAndMaybeResolve } from "@/utils/rule-requests";
import {
  addVoteToTally,
  countByPriority,
  filterByPriority,
  PRIORITIES,
  PRIORITY_LABEL,
  voteFractions,
  type Priority,
  type PriorityFilter,
  type VoteChoice,
  type VoteTally,
} from "@/utils/rule-utils";
import type { Database } from "@/utils/supabase-types";
import { useHideOnScroll, useTabAction } from "@/utils/tab-action";
import Add from "@expo/material-symbols/add.xml";
import CheckCircle from "@expo/material-symbols/check_circle.xml";
import Close from "@expo/material-symbols/close.xml";
import Flag from "@expo/material-symbols/flag.xml";
import Gavel from "@expo/material-symbols/gavel.xml";
import Lightbulb from "@expo/material-symbols/lightbulb.xml";
import NotificationsActive from "@expo/material-symbols/notifications_active.xml";
import Person from "@expo/material-symbols/person.xml";
import PriorityHigh from "@expo/material-symbols/priority_high.xml";
import {
  AnimatedVisibility,
  Box,
  Button,
  Card,
  Column,
  Icon,
  OutlinedButton,
  PullToRefreshBox,
  Row,
  Text,
} from "@expo/ui/jetpack-compose";
import {
  animateContentSize,
  background,
  clip,
  clickable,
  fillMaxHeight,
  fillMaxSize,
  fillMaxWidth,
  height,
  padding,
  paddingAll,
  Shapes,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useEffect, useState } from "react";

type RuleRow = Database["public"]["Tables"]["rules"]["Row"];
type RuleRequestRow = Database["public"]["Tables"]["rule_requests"]["Row"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];

const PRIORITY_ICON = { high: PriorityHigh, medium: Flag, low: Lightbulb };

const firstName = (fullname: string) => fullname.split(" ")[0] ?? fullname;

/** Priority label with its own icon on a tinted pill. */
const PriorityBadge = ({ priority }: { priority: string }) => {
  const colors = useAppColors();
  const p = (priority in PRIORITY_LABEL ? priority : "low") as Priority;
  const [bg, fg] =
    p === "high"
      ? [colors.errorContainer, colors.onErrorContainer]
      : p === "medium"
        ? [colors.tertiaryContainer, colors.onTertiaryContainer]
        : [colors.surfaceContainerHigh, colors.onSurfaceVariant];
  return (
    <Row
      modifiers={[
        clip(Shapes.RoundedCorner(8)),
        background(bg),
        padding(8, 4, 8, 4),
      ]}
    >
      <IconText
        icon={PRIORITY_ICON[p]}
        text={PRIORITY_LABEL[p]}
        color={fg}
        bold
      />
    </Row>
  );
};

export default function RulesScreen() {
  const hideOnScroll = useHideOnScroll();
  const { user } = useAuth();
  const colors = useAppColors();

  const [rules, setRules] = useState<RuleRow[]>([]);
  const [users, setUsers] = useState<Record<string, UserRow>>({});
  const [pendingRequests, setPendingRequests] = useState<RuleRequestRow[]>([]);
  const [tallies, setTallies] = useState<Record<string, VoteTally>>({});
  const [voterIds, setVoterIds] = useState<Record<string, string[]>>({});
  const [myVotes, setMyVotes] = useState<Record<string, VoteChoice>>({});
  const [eligibleVoterCount, setEligibleVoterCount] = useState(0);
  const [voting, setVoting] = useState<{ id: string; vote: VoteChoice } | null>(
    null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [remindedAt, setRemindedAt] = useState<Record<string, number>>({});
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [, tick] = useState(0);

  const [filter, setFilter] = useState<PriorityFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [proposeOpen, setProposeOpen] = useState(false);
  useTabAction("rules", Add, () => setProposeOpen(true));
  const [ruleText, setRuleText] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.role === "admin";
  const nonAdminUsers = Object.values(users).filter((u) => u.role !== "admin");
  const counts = countByPriority(rules);
  const visibleRules = filterByPriority(rules, filter);

  useEffect(() => {
    loadData();
  }, [user?.id]);

  // Re-renders every second so reminder cooldown countdowns stay live.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  async function loadData() {
    const [rulesRes, reqRes, usersRes] = await Promise.all([
      rulesApi.getAll(),
      ruleRequestsApi.getAll(),
      usersApi.getAll(),
    ]);
    if (rulesRes.data) setRules(rulesRes.data);

    const allUsers = usersRes.data ?? [];
    setUsers(Object.fromEntries(allUsers.map((u) => [u.id, u])));
    setEligibleVoterCount(allUsers.filter((u) => u.role !== "admin").length);

    if (reqRes.data && user) {
      const pending = reqRes.data.filter((r) => r.status === "pending");
      setPendingRequests(pending);

      if (!isAdmin) {
        const { data: myVoteRows } = await ruleRequestVotesApi.getAllMine(
          user.id,
        );
        setMyVotes(
          Object.fromEntries(
            (myVoteRows ?? []).map((v) => [
              v.rule_request_id,
              v.vote as VoteChoice,
            ]),
          ),
        );
      } else {
        setMyVotes({});
      }

      const entries = await Promise.all(
        pending.map(async (r) => {
          const [{ data: tally }, { data: voteRows }] = await Promise.all([
            ruleRequestVotesApi.getTally(r.id),
            ruleRequestVotesApi.getVoters(r.id),
          ]);
          return [
            r.id,
            tally?.[0],
            (voteRows ?? []).map((v: { voter_id: string }) => v.voter_id),
          ] as const;
        }),
      );
      setTallies(
        Object.fromEntries(
          entries.filter((e) => e[1]).map((e) => [e[0], e[1]!]),
        ),
      );
      setVoterIds(Object.fromEntries(entries.map((e) => [e[0], e[2]])));
    }
  }

  const onRefresh = () => {
    haptics.refresh();
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  };

  /** Applies the vote to local state right away, then syncs with the server (which also rolls back on failure). */
  async function handleVote(req: RuleRequestRow, vote: VoteChoice) {
    if (!user) return;
    setVoting({ id: req.id, vote });
    setMyVotes((p) => ({ ...p, [req.id]: vote }));
    setTallies((p) => ({ ...p, [req.id]: addVoteToTally(p[req.id], vote) }));
    setVoterIds((p) => ({ ...p, [req.id]: [...(p[req.id] ?? []), user.id] }));
    try {
      await castVoteAndMaybeResolve(req, user.id, vote, eligibleVoterCount);
      haptics.success();
    } catch (err: any) {
      haptics.error();
      alert(err.message);
    } finally {
      await loadData();
      setVoting(null);
    }
  }

  async function handleRemindNonVoters(
    req: RuleRequestRow,
    nonVoters: UserRow[],
  ) {
    if (cooldownRemaining(remindedAt[req.id] ?? null) > 0) return;
    setRemindingId(req.id);
    try {
      await sendPush({
        recipients: nonVoters.map((u) => u.id),
        type: "rule",
        title: "Vote Peraturan Menunggu",
        body: `"${req.rules}" masih menunggu vote kamu. Yuk vote sebelum ditutup!`,
        data: { ruleRequestId: req.id },
        categoryId: "rule_vote",
      });
      setRemindedAt((prev) => ({ ...prev, [req.id]: Date.now() }));
    } finally {
      setRemindingId(null);
    }
  }

  async function handlePropose() {
    setSubmitting(true);
    try {
      const { data: newRequest, error } = await ruleRequestsApi.create({
        rules: ruleText.trim(),
        priority,
        assign_by: user!.id,
        status: "pending",
      });
      if (error) throw error;
      haptics.success();
      setProposeOpen(false);
      setRuleText("");
      setPriority("medium");
      loadData();

      if (newRequest) {
        await sendPush({
          recipients: "voters_except_me",
          type: "rule",
          title: "Usulan Peraturan Baru",
          body: `${user!.fullname} mengusulkan peraturan baru. Yuk vote!`,
          data: { ruleRequestId: newRequest.id },
          categoryId: "rule_vote",
        });
      }
    } catch (err: any) {
      haptics.error();
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const renderRequest = (req: RuleRequestRow) => {
    const tally = tallies[req.id] ?? {
      approve_count: 0,
      decline_count: 0,
      total_votes: 0,
    };
    const isOwn = req.assign_by === user?.id;
    const myVote = myVotes[req.id];
    const busy = voting?.id === req.id;
    const canVote = !isAdmin && !isOwn && (!myVote || busy);
    const votedIdSet = new Set(voterIds[req.id] ?? []);
    const votedUsers = nonAdminUsers.filter((u) => votedIdSet.has(u.id));
    const nonVoters = nonAdminUsers.filter((u) => !votedIdSet.has(u.id));
    const frac = voteFractions(
      tally.approve_count,
      tally.decline_count,
      eligibleVoterCount,
    );
    const cooldown = cooldownRemaining(remindedAt[req.id] ?? null);

    return (
      <Card
        key={req.id}
        colors={{ containerColor: colors.surfaceContainerLow }}
        modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(20))]}
      >
        <Column
          verticalArrangement={{ spacedBy: 12 }}
          modifiers={[fillMaxWidth(), paddingAll(16)]}
        >
          <Row
            verticalAlignment="center"
            horizontalArrangement="spaceBetween"
            modifiers={[fillMaxWidth()]}
          >
            <PriorityBadge priority={req.priority} />
            <Text
              style={{ typography: "labelMedium" }}
              color={colors.onSurfaceVariant}
            >
              {`Diusulkan ${firstName(users[req.assign_by ?? ""]?.fullname ?? "Seseorang")}`}
            </Text>
          </Row>

          <Text
            style={{ typography: "bodyLarge", fontWeight: "600" }}
            color={colors.onSurface}
          >
            {`"${req.rules}"`}
          </Text>

          <Row
            modifiers={[
              fillMaxWidth(),
              height(8),
              clip(Shapes.RoundedCorner(4)),
              background(colors.surfaceContainerHighest),
              animateContentSize(),
            ]}
          >
            {(
              [
                [frac.approve, colors.primary],
                [frac.decline, colors.error],
                [frac.rest, null],
              ] as const
            ).map(([w, c], i) =>
              w > 0 ? (
                <Box
                  key={i}
                  modifiers={[
                    weight(w),
                    fillMaxHeight(),
                    ...(c ? [background(c)] : []),
                  ]}
                />
              ) : null,
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
            <Row horizontalArrangement={{ spacedBy: -8 }}>
              {votedUsers.slice(0, 5).map((v) => (
                <VoterAvatar key={v.id} user={v} diameter={24} />
              ))}
            </Row>
          )}

          {canVote ? (
            <Row
              horizontalArrangement={{ spacedBy: 12 }}
              modifiers={[fillMaxWidth()]}
            >
              <OutlinedButton
                enabled={!busy}
                onClick={() => handleVote(req, "decline")}
                modifiers={[weight(1), height(48)]}
              >
                <ButtonContent
                  loading={busy && voting?.vote === "decline"}
                  enabled={!busy}
                  label="Tolak"
                  color={colors.primary}
                />
              </OutlinedButton>
              <Button
                enabled={!busy}
                onClick={() => handleVote(req, "approve")}
                modifiers={[weight(1), height(48)]}
              >
                <ButtonContent
                  loading={busy && voting?.vote === "approve"}
                  enabled={!busy}
                  label="Setuju"
                  color={colors.onPrimary}
                />
              </Button>
            </Row>
          ) : isAdmin ? (
            <IconText icon={Gavel} text="Admin tidak ikut vote" />
          ) : (
            <IconText
              icon={isOwn ? Person : myVote === "approve" ? CheckCircle : Close}
              text={
                isOwn
                  ? "Diajukan olehmu"
                  : `Kamu vote: ${myVote === "approve" ? "Setuju" : "Tolak"}`
              }
              color={colors.onSurface}
              bold
            />
          )}

          {isOwn && nonVoters.length > 0 && (
            <OutlinedButton
              enabled={cooldown === 0 && remindingId !== req.id}
              onClick={() => handleRemindNonVoters(req, nonVoters)}
              modifiers={[fillMaxWidth(), height(48)]}
            >
              <Row
                verticalAlignment="center"
                horizontalArrangement={{ spacedBy: 6 }}
              >
                <Icon
                  source={NotificationsActive}
                  tint={colors.primary}
                  size={16}
                />
                <Text
                  style={{ typography: "labelLarge" }}
                  color={colors.primary}
                >
                  {cooldown > 0
                    ? `Ingatkan lagi dalam ${formatCooldown(cooldown)}`
                    : `Ingatkan ${nonVoters.length} yang belum vote`}
                </Text>
              </Row>
            </OutlinedButton>
          )}
        </Column>
      </Card>
    );
  };

  const renderRule = (r: RuleRow, i: number) => {
    const open = expandedId === r.id;
    const proposer = users[r.assign_by ?? ""]?.fullname;
    const date = r.created_at
      ? new Date(r.created_at).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;
    return (
      <Card
        key={r.id}
        colors={{ containerColor: colors.surfaceContainerLow }}
        modifiers={[
          fillMaxWidth(),
          clip(Shapes.RoundedCorner(16)),
          clickable(() => setExpandedId(open ? null : r.id)),
        ]}
      >
        <Column
          verticalArrangement={{ spacedBy: 8 }}
          modifiers={[fillMaxWidth(), paddingAll(16)]}
        >
          <Row
            horizontalArrangement={{ spacedBy: 12 }}
            modifiers={[fillMaxWidth()]}
          >
            <Text
              style={{ typography: "titleMedium", fontWeight: "bold" }}
              color={colors.primary}
            >
              {String(i + 1)}
            </Text>
            <Column
              verticalArrangement={{ spacedBy: 8 }}
              modifiers={[weight(1)]}
            >
              <Text
                style={{ typography: "bodyMedium" }}
                color={colors.onSurface}
              >
                {r.rules}
              </Text>
              <PriorityBadge priority={r.priority} />
              <AnimatedVisibility visible={open}>
                <IconText
                  icon={Person}
                  text={`Diusulkan ${proposer ? firstName(proposer) : "seseorang"}${date ? ` · ${date}` : ""}`}
                />
              </AnimatedVisibility>
            </Column>
          </Row>
        </Column>
      </Card>
    );
  };

  return (
    <AppHost style={{ flex: 1 }}>
      <Box modifiers={[fillMaxSize()]}>
        <PullToRefreshBox
          isRefreshing={refreshing}
          onRefresh={onRefresh}
          contentAlignment="topCenter"
          modifiers={[fillMaxSize(), background(colors.background)]}
        >
          <Column
            verticalArrangement={{ spacedBy: 24 }}
            modifiers={[fillMaxSize(), hideOnScroll, padding(16, 56, 16, 120)]}
          >
            <Text
              style={{ typography: "headlineMedium", fontWeight: "bold" }}
              color={colors.onBackground}
            >
              Aturan
            </Text>

            {pendingRequests.length > 0 && (
              <Column verticalArrangement={{ spacedBy: 12 }}>
                <SectionLabel>
                  {`${isAdmin ? "SEDANG DI-VOTE" : "BUTUH VOTE KAMU"} · ${pendingRequests.length}`}
                </SectionLabel>
                {pendingRequests.map(renderRequest)}
              </Column>
            )}

            <Column verticalArrangement={{ spacedBy: 12 }}>
              <SectionLabel>{`ATURAN AKTIF · ${rules.length}`}</SectionLabel>
              {rules.length > 0 && (
                <ChipRow
                  options={[
                    ["all", `Semua ${counts.all}`],
                    ...PRIORITIES.map(
                      (p) =>
                        [p, `${PRIORITY_LABEL[p]} ${counts[p]}`] as [
                          Priority,
                          string,
                        ],
                    ),
                  ]}
                  value={filter}
                  onChange={setFilter}
                />
              )}
              {rules.length === 0 ? (
                <EmptyState
                  icon={Gavel}
                  text="Belum ada peraturan aktif."
                  action="Usulkan peraturan"
                  onAction={() => setProposeOpen(true)}
                />
              ) : visibleRules.length === 0 ? (
                <EmptyState
                  icon={Gavel}
                  text="Tidak ada aturan di kategori ini."
                  action="Lihat semua"
                  onAction={() => setFilter("all")}
                />
              ) : (
                <Column verticalArrangement={{ spacedBy: 8 }}>
                  {visibleRules.map(renderRule)}
                </Column>
              )}
            </Column>
          </Column>
        </PullToRefreshBox>
      </Box>

      {proposeOpen && (
        <FormSheet
          title="Usulkan peraturan"
          subtitle="Penghuni lain akan memberi vote untuk usulan kamu."
          onClose={() => setProposeOpen(false)}
        >
          <FormField
            label="Teks peraturan"
            onValueChange={setRuleText}
            minLines={3}
            keyboardOptions={{ capitalization: "sentences" }}
          />
          <SectionLabel>Prioritas</SectionLabel>
          <ChipRow
            options={PRIORITIES.map(
              (p) => [p, PRIORITY_LABEL[p]] as [Priority, string],
            )}
            value={priority}
            onChange={setPriority}
          />
          <SheetActions
            onCancel={() => setProposeOpen(false)}
            onSubmit={handlePropose}
            submitLabel="Ajukan"
            enabled={ruleText.trim().length > 0}
            loading={submitting}
          />
        </FormSheet>
      )}
    </AppHost>
  );
}
