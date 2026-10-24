import { haptics } from "@/utils/haptics";
import { AppHost, useAppColors } from "@/components/AppHost";
import { BackButton } from "@/components/BackButton";
import { FormField } from "@/components/FormField";
import { FormSheet, SheetActions } from "@/components/FormSheet";
import { ChipRow, EmptyState, IconText } from "@/components/ListBits";
import { VoterAvatar } from "@/components/VoterAvatar";
import { requestsApi, requestVotesApi, usersApi } from "@/services/api";
import { useAuth } from "@/utils/auth-context";
import {
  applyRequestVote,
  castRequestVote,
  createRequestAndNotify,
  requestScore,
  sortRequests,
  type RequestSort,
} from "@/utils/requests";
import type { Database } from "@/utils/supabase-types";
import { useHideOnScroll, useTabAction } from "@/utils/tab-action";
import Add from "@expo/material-symbols/add.xml";
import ArrowDownward from "@expo/material-symbols/arrow_downward.xml";
import ArrowUpward from "@expo/material-symbols/arrow_upward.xml";
import Delete from "@expo/material-symbols/delete.xml";
import Forum from "@expo/material-symbols/forum.xml";
import LocalFireDepartment from "@expo/material-symbols/local_fire_department.xml";
import {
  AnimatedVisibility,
  Box,
  Card,
  Column,
  Icon,
  IconButton,
  PullToRefreshBox,
  Row,
  Text,
  TextButton,
} from "@expo/ui/jetpack-compose";
import {
  animateContentSize,
  background,
  clickable,
  clip,
  fillMaxSize,
  fillMaxWidth,
  padding,
  paddingAll,
  Shapes,
  weight,
  width,
} from "@expo/ui/jetpack-compose/modifiers";
import { useEffect, useState } from "react";
import { Alert } from "react-native";

type RequestRow = Database["public"]["Tables"]["requests"]["Row"];
type RequestVoteRow = Database["public"]["Tables"]["request_votes"]["Row"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];

const firstName = (fullname: string) => fullname.split(" ")[0] ?? fullname;

function timeAgo(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes}m lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}j lalu`;
  return `${Math.floor(hours / 24)}h lalu`;
}

export default function RequestsScreen() {
  const { user } = useAuth();
  const colors = useAppColors();
  const hideOnScroll = useHideOnScroll();
  const isAdmin = user?.role === "admin";

  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [users, setUsers] = useState<Record<string, UserRow>>({});
  const [votesByRequest, setVotesByRequest] = useState<
    Record<string, RequestVoteRow[]>
  >({});
  const [votingId, setVotingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<RequestSort>("top");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  useTabAction("requests", Add, () => setCreateOpen(true));
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [requestsRes, votesRes, usersRes] = await Promise.all([
      requestsApi.getAll(),
      requestVotesApi.getAll(),
      usersApi.getAll(),
    ]);
    if (requestsRes.data) setRequests(requestsRes.data);
    setUsers(Object.fromEntries((usersRes.data ?? []).map((u) => [u.id, u])));
    const grouped: Record<string, RequestVoteRow[]> = {};
    (votesRes.data ?? []).forEach((v) => {
      (grouped[v.request_id] ??= []).push(v);
    });
    setVotesByRequest(grouped);
  }

  const onRefresh = () => {
    haptics.refresh();
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  };

  const myVote = (requestId: string) =>
    (votesByRequest[requestId]?.find((v) => v.user_id === user?.id)
      ?.vote_value as 1 | -1 | undefined) ?? null;

  /** Moves the score right away, then syncs with the server (reloading undoes it on failure). */
  async function handleVote(req: RequestRow, value: 1 | -1) {
    if (!user || votingId) return;
    const current = myVote(req.id);
    setVotingId(req.id);
    setVotesByRequest((p) => ({
      ...p,
      [req.id]: applyRequestVote(p[req.id], req.id, user.id, value),
    }));
    try {
      await castRequestVote(req.id, user.id, value, current);
      haptics.success();
    } catch (err: any) {
      haptics.error();
      alert(err.message);
    } finally {
      await loadData();
      setVotingId(null);
    }
  }

  const confirmDelete = (req: RequestRow) =>
    Alert.alert("Hapus request?", `"${req.title}" dan semua vote-nya akan dihapus.`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          const { error } = await requestsApi.delete(req.id);
          if (error) {
            haptics.error();
            alert(error.message);
          }
          else loadData();
        },
      },
    ]);

  async function handleCreate() {
    if (!title.trim() || !user) return;
    setSubmitting(true);
    try {
      await createRequestAndNotify({ title, description }, user);
      haptics.success();
      setCreateOpen(false);
      setTitle("");
      setDescription("");
      setSort("new");
      loadData();
    } catch (err: any) {
      haptics.error();
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const visible = sortRequests(requests, votesByRequest, sort, user?.id);
  const mineCount = requests.filter((r) => r.creator_id === user?.id).length;
  const unvoted = requests.filter(
    (r) => r.creator_id !== user?.id && myVote(r.id) === null,
  ).length;

  const renderRequest = (req: RequestRow, i: number) => {
    const votes = votesByRequest[req.id] ?? [];
    const score = requestScore(votes);
    const vote = myVote(req.id);
    const open = expandedId === req.id;
    const isTop = sort === "top" && i === 0 && score > 0;
    const canDelete = req.creator_id === user?.id || isAdmin;
    const creator = users[req.creator_id];
    const supporters = votes
      .filter((v) => v.vote_value === 1)
      .map((v) => users[v.user_id])
      .filter(Boolean);

    const cardBg = isTop ? colors.primaryContainer : colors.surfaceContainerLow;
    const fg = isTop ? colors.onPrimaryContainer : colors.onSurface;
    const muted = isTop ? colors.onPrimaryContainer : colors.onSurfaceVariant;
    // The pill fills with the user's own vote so it reads at a glance.
    const [pillBg, pillFg] =
      vote === 1
        ? [colors.primary, colors.onPrimary]
        : vote === -1
          ? [colors.errorContainer, colors.onErrorContainer]
          : [isTop ? colors.surfaceContainerLowest : colors.surfaceContainerHigh, colors.onSurfaceVariant];

    return (
      <Card
        key={req.id}
        colors={{ containerColor: cardBg }}
        modifiers={[
          fillMaxWidth(),
          clip(Shapes.RoundedCorner(20)),
          clickable(() => setExpandedId(open ? null : req.id)),
          animateContentSize(),
        ]}
      >
        <Row
          horizontalArrangement={{ spacedBy: 12 }}
          modifiers={[fillMaxWidth(), paddingAll(12)]}
        >
          <Column
            horizontalAlignment="center"
            modifiers={[width(48), clip(Shapes.RoundedCorner(24)), background(pillBg)]}
          >
            <IconButton onClick={() => handleVote(req, 1)}>
              <Icon source={ArrowUpward} tint={pillFg} size={20} />
            </IconButton>
            <Text style={{ typography: "titleMedium", fontWeight: "bold" }} color={pillFg}>
              {String(score)}
            </Text>
            <IconButton onClick={() => handleVote(req, -1)}>
              <Icon source={ArrowDownward} tint={pillFg} size={20} />
            </IconButton>
          </Column>

          <Column
            verticalArrangement={{ spacedBy: 6 }}
            modifiers={[weight(1), padding(0, 4, 4, 4)]}
          >
            {isTop && (
              <IconText icon={LocalFireDepartment} text="Paling didukung" color={fg} bold />
            )}
            <Text
              style={{ typography: "titleMedium", fontWeight: "bold" }}
              color={fg}
              maxLines={open ? undefined : 2}
              overflow="ellipsis"
            >
              {req.title}
            </Text>
            {req.description ? (
              <Text
                style={{ typography: "bodyMedium" }}
                color={muted}
                maxLines={open ? undefined : 2}
                overflow="ellipsis"
              >
                {req.description}
              </Text>
            ) : null}
            <Row
              verticalAlignment="center"
              horizontalArrangement={{ spacedBy: 8 }}
              modifiers={[fillMaxWidth(), padding(0, 4, 0, 0)]}
            >
              {creator && <VoterAvatar user={creator} diameter={20} ring={cardBg} />}
              <Text style={{ typography: "labelMedium" }} color={muted} modifiers={[weight(1)]}>
                {`${firstName(creator?.fullname ?? "Seseorang")} · ${timeAgo(req.created_at)}`}
              </Text>
              {supporters.length > 0 && (
                <Row horizontalArrangement={{ spacedBy: -6 }}>
                  {supporters.slice(0, 4).map((u) => (
                    <VoterAvatar key={u.id} user={u} diameter={20} ring={cardBg} />
                  ))}
                </Row>
              )}
            </Row>
            {canDelete && (
              <AnimatedVisibility visible={open}>
                <TextButton onClick={() => confirmDelete(req)}>
                  <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 6 }}>
                    <Icon source={Delete} tint={colors.error} size={18} />
                    <Text style={{ typography: "labelLarge" }} color={colors.error}>
                      Hapus request
                    </Text>
                  </Row>
                </TextButton>
              </AnimatedVisibility>
            )}
          </Column>
        </Row>
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
            verticalArrangement={{ spacedBy: 16 }}
            modifiers={[fillMaxSize(), hideOnScroll, padding(16, 56, 16, 120)]}
          >
            <Row
              verticalAlignment="center"
              horizontalArrangement={{ spacedBy: 4 }}
              modifiers={[fillMaxWidth()]}
            >
              <BackButton />
              <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[weight(1)]}>
                <Text
                  style={{ typography: "headlineMedium", fontWeight: "bold" }}
                  color={colors.onBackground}
                >
                  Request
                </Text>
                <Text style={{ typography: "bodyMedium" }} color={colors.onSurfaceVariant}>
                  {unvoted > 0
                    ? `${unvoted} usulan belum kamu vote`
                    : "Usulan bebas dari anggota, vote yang kamu setuju"}
                </Text>
              </Column>
            </Row>

            {requests.length > 0 && (
              <ChipRow
                options={[
                  ["top", "Populer"],
                  ["new", "Terbaru"],
                  ["mine", `Punyaku ${mineCount}`],
                ]}
                value={sort}
                onChange={setSort}
              />
            )}

            {requests.length === 0 ? (
              <EmptyState
                icon={Forum}
                text="Belum ada request."
                action="Buat request"
                onAction={() => setCreateOpen(true)}
              />
            ) : visible.length === 0 ? (
              <EmptyState
                icon={Forum}
                text="Kamu belum membuat request."
                action="Buat request"
                onAction={() => setCreateOpen(true)}
              />
            ) : (
              <Column verticalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
                {visible.map(renderRequest)}
              </Column>
            )}
          </Column>
        </PullToRefreshBox>
      </Box>

      {createOpen && (
        <FormSheet
          title="Buat request baru"
          subtitle="Anggota lain akan diberi tahu dan bisa vote."
          onClose={() => setCreateOpen(false)}
        >
          <FormField
            label="Judul"
            onValueChange={setTitle}
            singleLine
            keyboardOptions={{ capitalization: "sentences" }}
          />
          <FormField
            label="Deskripsi (opsional)"
            onValueChange={setDescription}
            minLines={3}
            keyboardOptions={{ capitalization: "sentences" }}
          />
          <SheetActions
            onCancel={() => setCreateOpen(false)}
            onSubmit={handleCreate}
            submitLabel="Buat"
            enabled={title.trim().length > 0}
            loading={submitting}
          />
        </FormSheet>
      )}
    </AppHost>
  );
}
