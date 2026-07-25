import { ButtonContent } from "@/components/ButtonContent";
import { requestsApi, requestVotesApi, usersApi } from "@/services/api";
import { useAuth } from "@/utils/auth-context";
import { castRequestVote, createRequestAndNotify } from "@/utils/requests";
import type { Database } from "@/utils/supabase-types";
import Add from "@expo/material-symbols/add.xml";
import ArrowBack from "@expo/material-symbols/arrow_back.xml";
import ArrowDownward from "@expo/material-symbols/arrow_downward.xml";
import ArrowUpward from "@expo/material-symbols/arrow_upward.xml";
import Delete from "@expo/material-symbols/delete.xml";
import Forum from "@expo/material-symbols/forum.xml";
import { Host } from "@expo/ui";
import {
  Box,
  Button,
  Column,
  ExtendedFloatingActionButton,
  HorizontalDivider,
  Icon,
  IconButton,
  ModalBottomSheet,
  OutlinedButton,
  OutlinedTextField,
  PullToRefreshBox,
  Row,
  Text,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  align,
  background,
  clip,
  fillMaxSize,
  fillMaxWidth,
  padding,
  Shapes,
  size,
  verticalScroll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { router } from "expo-router";
import { useEffect, useState } from "react";

type RequestRow = Database["public"]["Tables"]["requests"]["Row"];
type RequestVoteRow = Database["public"]["Tables"]["request_votes"]["Row"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];

const firstName = (fullname: string) => fullname.split(" ")[0] ?? fullname;

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes}m lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}j lalu`;
  const days = Math.floor(hours / 24);
  return `${days}h lalu`;
}

export default function RequestsScreen() {
  const { user } = useAuth();
  const colors = useMaterialColors();
  const isAdmin = user?.role === "admin";

  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [users, setUsers] = useState<Record<string, UserRow>>({});
  const [votesByRequest, setVotesByRequest] = useState<
    Record<string, RequestVoteRow[]>
  >({});
  const [votingId, setVotingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = title.trim().length > 0;

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

    const userMap: Record<string, UserRow> = {};
    (usersRes.data ?? []).forEach((u) => {
      userMap[u.id] = u;
    });
    setUsers(userMap);

    const grouped: Record<string, RequestVoteRow[]> = {};
    (votesRes.data ?? []).forEach((v) => {
      if (!grouped[v.request_id]) grouped[v.request_id] = [];
      grouped[v.request_id].push(v);
    });
    setVotesByRequest(grouped);
  }

  const onRefresh = () => {
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  };

  function netScore(requestId: string): number {
    const votes = votesByRequest[requestId] ?? [];
    const raw = votes.reduce((sum, v) => sum + v.vote_value, 0);
    // Individual up/downvotes are still recorded normally underneath — only
    // the displayed/sorted aggregate is floored so a request never reads
    // as "negative" even when downvotes outnumber upvotes.
    return Math.max(0, raw);
  }

  function myVote(requestId: string): 1 | -1 | null {
    const votes = votesByRequest[requestId] ?? [];
    const mine = votes.find((v) => v.user_id === user?.id);
    return (mine?.vote_value as 1 | -1 | undefined) ?? null;
  }

  async function handleVote(req: RequestRow, value: 1 | -1) {
    if (!user) return;
    setVotingId(req.id);
    try {
      await castRequestVote(req.id, user.id, value, myVote(req.id));
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setVotingId(null);
    }
  }

  async function handleDelete(req: RequestRow) {
    const { error } = await requestsApi.delete(req.id);
    if (error) {
      alert(error.message);
      return;
    }
    loadData();
  }

  async function handleCreate() {
    if (!canSubmit || !user) return;
    setSubmitting(true);
    try {
      await createRequestAndNotify({ title, description }, user);
      setCreateOpen(false);
      setTitle("");
      setDescription("");
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const sortedRequests = [...requests].sort((a, b) => {
    const diff = netScore(b.id) - netScore(a.id);
    if (diff !== 0) return diff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

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
                  Request
                </Text>
                <Text
                  style={{ typography: "bodySmall" }}
                  color={colors.onSurfaceVariant}
                >
                  Usulan bebas dari anggota, vote yang kamu setuju
                </Text>
              </Column>
            </Row>

            {sortedRequests.length === 0 ? (
              <Column
                horizontalAlignment="center"
                verticalArrangement={{ spacedBy: 12 }}
                modifiers={[fillMaxWidth(), padding(8, 40, 8, 40)]}
              >
                <Box
                  contentAlignment="center"
                  modifiers={[
                    size(72, 72),
                    clip(Shapes.RoundedCorner(36)),
                    background(colors.secondaryContainer),
                  ]}
                >
                  <Icon
                    source={Forum}
                    tint={colors.onSecondaryContainer}
                    size={32}
                  />
                </Box>
                <Column
                  horizontalAlignment="center"
                  verticalArrangement={{ spacedBy: 2 }}
                >
                  <Text
                    style={{ typography: "bodyLarge", fontWeight: "bold" }}
                    color={colors.onSurface}
                  >
                    Belum ada request
                  </Text>
                  <Text
                    style={{ typography: "bodySmall", textAlign: "center" }}
                    color={colors.onSurfaceVariant}
                  >
                    Buat request baru lewat tombol di bawah.
                  </Text>
                </Column>
              </Column>
            ) : (
              <Column
                verticalArrangement={{ spacedBy: 4 }}
                modifiers={[fillMaxWidth()]}
              >
                {sortedRequests.map((req, i) => {
                  const score = netScore(req.id);
                  const vote = myVote(req.id);
                  const isVoting = votingId === req.id;
                  const isOwn = req.creator_id === user?.id;
                  const creator = users[req.creator_id];

                  return (
                    <Column key={req.id}>
                      <Row
                        verticalAlignment="center"
                        horizontalArrangement={{ spacedBy: 12 }}
                        modifiers={[fillMaxWidth(), padding(0, 10, 0, 10)]}
                      >
                        <Column
                          horizontalAlignment="center"
                          verticalArrangement={{ spacedBy: 0 }}
                        >
                          <IconButton
                            enabled={!isVoting}
                            onClick={() => handleVote(req, 1)}
                          >
                            <Icon
                              source={ArrowUpward}
                              tint={
                                vote === 1
                                  ? colors.primary
                                  : colors.onSurfaceVariant
                              }
                              size={20}
                            />
                          </IconButton>
                          <Text
                            style={{
                              typography: "labelLarge",
                              fontWeight: "bold",
                            }}
                            color={
                              score > 0
                                ? colors.primary
                                : colors.onSurfaceVariant
                            }
                          >
                            {String(score)}
                          </Text>
                          <IconButton
                            enabled={!isVoting}
                            onClick={() => handleVote(req, -1)}
                          >
                            <Icon
                              source={ArrowDownward}
                              tint={
                                vote === -1
                                  ? colors.error
                                  : colors.onSurfaceVariant
                              }
                              size={20}
                            />
                          </IconButton>
                        </Column>

                        <Column
                          verticalArrangement={{ spacedBy: 2 }}
                          modifiers={[weight(1)]}
                        >
                          <Text
                            style={{
                              typography: "bodyLarge",
                              fontWeight: "600",
                            }}
                            color={colors.onSurface}
                          >
                            {req.title}
                          </Text>
                          {req.description && (
                            <Text
                              style={{ typography: "bodyMedium" }}
                              color={colors.onSurfaceVariant}
                            >
                              {req.description}
                            </Text>
                          )}
                          <Text
                            style={{ typography: "labelSmall" }}
                            color={colors.onSurfaceVariant}
                          >
                            {`${firstName(creator?.fullname ?? "Seseorang")} · ${timeAgo(req.created_at)}`}
                          </Text>
                        </Column>

                        {(isOwn || isAdmin) && (
                          <IconButton onClick={() => handleDelete(req)}>
                            <Icon
                              source={Delete}
                              tint={colors.error}
                              size={18}
                            />
                          </IconButton>
                        )}
                      </Row>
                      {i < sortedRequests.length - 1 && (
                        <HorizontalDivider color={colors.outlineVariant} />
                      )}
                    </Column>
                  );
                })}
              </Column>
            )}
          </Column>
        </PullToRefreshBox>

        <ExtendedFloatingActionButton
          onClick={() => setCreateOpen(true)}
          modifiers={[align("bottomEnd"), padding(0, 0, 20, 24)]}
        >
          <ExtendedFloatingActionButton.Icon>
            <Icon source={Add} size={20} />
          </ExtendedFloatingActionButton.Icon>
          <ExtendedFloatingActionButton.Text>
            <Text style={{ typography: "labelLarge", fontWeight: "bold" }}>
              Buat Request
            </Text>
          </ExtendedFloatingActionButton.Text>
        </ExtendedFloatingActionButton>
      </Box>

      {createOpen && (
        <ModalBottomSheet onDismissRequest={() => setCreateOpen(false)}>
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
                Buat request baru
              </Text>
              <Text
                style={{ typography: "bodyMedium" }}
                color={colors.onSurfaceVariant}
              >
                Anggota lain akan diberi tahu dan bisa vote.
              </Text>
            </Column>

            <OutlinedTextField
              onValueChange={setTitle}
              singleLine
              keyboardOptions={{ capitalization: "sentences" }}
              modifiers={[fillMaxWidth()]}
            >
              <OutlinedTextField.Label>
                <Text>Judul</Text>
              </OutlinedTextField.Label>
            </OutlinedTextField>

            <OutlinedTextField
              onValueChange={setDescription}
              minLines={3}
              keyboardOptions={{ capitalization: "sentences" }}
              modifiers={[fillMaxWidth()]}
            >
              <OutlinedTextField.Label>
                <Text>Deskripsi (opsional)</Text>
              </OutlinedTextField.Label>
            </OutlinedTextField>

            <Row
              verticalAlignment="center"
              horizontalArrangement={{ spacedBy: 12 }}
              modifiers={[fillMaxWidth()]}
            >
              <OutlinedButton
                onClick={() => setCreateOpen(false)}
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
                enabled={canSubmit && !submitting}
                onClick={handleCreate}
                modifiers={[weight(1)]}
              >
                <ButtonContent
                  loading={submitting}
                  enabled={canSubmit}
                  label="Buat"
                  color={colors.onPrimary}
                />
              </Button>
            </Row>
          </Column>
        </ModalBottomSheet>
      )}
    </Host>
  );
}
