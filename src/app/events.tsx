import { ButtonContent } from "@/components/ButtonContent";
import { VoterAvatar } from "@/components/VoterAvatar";
import { eventsApi, eventVotesApi, usersApi } from "@/services/api";
import { useAuth } from "@/utils/auth-context";
import { cooldownRemaining, formatCooldown } from "@/utils/cooldown";
import { castEventVote, createEventAndNotify } from "@/utils/events";
import { sendPushNotification } from "@/utils/notifications";
import type { Database } from "@/utils/supabase-types";
import Add from "@expo/material-symbols/add.xml";
import ArrowBack from "@expo/material-symbols/arrow_back.xml";
import Event from "@expo/material-symbols/event.xml";
import History from "@expo/material-symbols/history.xml";
import LocationOn from "@expo/material-symbols/location_on.xml";
import NotificationsActive from "@expo/material-symbols/notifications_active.xml";
import Schedule from "@expo/material-symbols/schedule.xml";
import { Host } from "@expo/ui";
import {
  Box,
  Button,
  Card,
  Column,
  DatePickerDialog,
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
  TimePickerDialog,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
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
  Shapes,
  size,
  verticalScroll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type EventVoteRow = Database["public"]["Tables"]["event_votes"]["Row"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];

const firstName = (fullname: string) => fullname.split(" ")[0] ?? fullname;

function formatEventDateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const time = d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date}, ${time}`;
}

/** Keeps the currently-picked time-of-day while swapping in a new date. */
function mergeDatePart(base: Date | null, datePart: Date): Date {
  const result = base ? new Date(base) : new Date();
  result.setFullYear(
    datePart.getFullYear(),
    datePart.getMonth(),
    datePart.getDate(),
  );
  return result;
}

/** Keeps the currently-picked date while swapping in a new time-of-day. */
function mergeTimePart(base: Date | null, timePart: Date): Date {
  const result = base ? new Date(base) : new Date();
  result.setHours(timePart.getHours(), timePart.getMinutes(), 0, 0);
  return result;
}

export default function EventsScreen() {
  const { user } = useAuth();
  const colors = useMaterialColors();

  const [events, setEvents] = useState<EventRow[]>([]);
  const [users, setUsers] = useState<Record<string, UserRow>>({});
  const [votesByEvent, setVotesByEvent] = useState<
    Record<string, EventVoteRow[]>
  >({});
  const [myVotes, setMyVotes] = useState<Record<string, boolean>>({});
  const [votingId, setVotingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [remindedAt, setRemindedAt] = useState<Record<string, number>>({});
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [, tick] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [pickedDate, setPickedDate] = useState<Date | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Computed once, not on every render — the reminder-cooldown countdown
  // below re-renders this screen every second, and passing a fresh Date/
  // object literal to the native date picker on every tick was resetting
  // its in-progress selection back to today while the user was browsing it.
  const [pickerNow] = useState(() => new Date());
  const [pickerToday] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const selectableDates = useMemo(
    () => ({ start: pickerToday }),
    [pickerToday],
  );

  const canSubmit =
    name.trim().length > 0 &&
    location.trim().length > 0 &&
    !!pickedDate &&
    pickedDate.getTime() > Date.now();

  useEffect(() => {
    loadData();
  }, [user?.id]);

  // Re-renders every second so reminder cooldown countdowns (and the
  // upcoming/past split) stay live.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  async function loadData() {
    const [eventsRes, votesRes, usersRes] = await Promise.all([
      eventsApi.getAll(),
      eventVotesApi.getAll(),
      usersApi.getAll(),
    ]);
    if (eventsRes.data) setEvents(eventsRes.data);

    const userMap: Record<string, UserRow> = {};
    (usersRes.data ?? []).forEach((u) => {
      userMap[u.id] = u;
    });
    setUsers(userMap);

    const grouped: Record<string, EventVoteRow[]> = {};
    const mine: Record<string, boolean> = {};
    (votesRes.data ?? []).forEach((v) => {
      if (!grouped[v.event_id]) grouped[v.event_id] = [];
      grouped[v.event_id].push(v);
      if (user && v.user_id === user.id) mine[v.event_id] = v.is_attending;
    });
    setVotesByEvent(grouped);
    setMyVotes(mine);
  }

  const onRefresh = () => {
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  };

  async function handleVote(event: EventRow, isAttending: boolean) {
    if (!user) return;
    setVotingId(event.id);
    try {
      await castEventVote(
        event,
        user.id,
        isAttending,
        myVotes[event.id] ?? null,
      );
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setVotingId(null);
    }
  }

  async function handleRemindAttendees(
    event: EventRow,
    attendingUsers: UserRow[],
  ) {
    if (cooldownRemaining(remindedAt[event.id] ?? null) > 0) return;
    setRemindingId(event.id);
    try {
      const tokens = attendingUsers
        .map((u) => u.push_token)
        .filter((t): t is string => !!t);
      await Promise.all(
        tokens.map((token) =>
          sendPushNotification(
            token,
            "Pengingat Acara",
            `"${event.name}" akan berlangsung hari ini di ${event.location}.`,
            { data: { eventId: event.id } },
          ),
        ),
      );
      setRemindedAt((prev) => ({ ...prev, [event.id]: Date.now() }));
    } finally {
      setRemindingId(null);
    }
  }

  async function handleCreate() {
    if (!canSubmit || !pickedDate || !user) return;
    setSubmitting(true);
    try {
      await createEventAndNotify(
        { name, location, event_time: pickedDate.toISOString() },
        user,
      );
      setCreateOpen(false);
      setName("");
      setLocation("");
      setPickedDate(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.event_time).getTime() > now);
  // History only surfaces past events the user actually took part in —
  // ones they created, or voted on (attending or not) — not every event
  // that ever happened.
  const pastRelevant = events
    .filter(
      (e) =>
        new Date(e.event_time).getTime() <= now &&
        (e.creator_id === user?.id || myVotes[e.id] !== undefined),
    )
    .reverse();
  const totalMembers = Object.keys(users).length;

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
                  Event
                </Text>
                <Text
                  style={{ typography: "bodySmall" }}
                  color={colors.onSurfaceVariant}
                >
                  Acara kontrakan, ikut kalau kamu mau
                </Text>
              </Column>
              <OutlinedButton onClick={() => setHistoryOpen(true)}>
                <Row
                  verticalAlignment="center"
                  horizontalArrangement={{ spacedBy: 6 }}
                >
                  <Icon source={History} tint={colors.primary} size={18} />
                  <Text
                    style={{ typography: "labelLarge" }}
                    color={colors.primary}
                  >
                    Riwayat
                  </Text>
                </Row>
              </OutlinedButton>
            </Row>

            {upcoming.length === 0 ? (
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
                    source={Event}
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
                    Belum ada acara mendatang
                  </Text>
                  <Text
                    style={{ typography: "bodySmall", textAlign: "center" }}
                    color={colors.onSurfaceVariant}
                  >
                    Buat acara baru lewat tombol di bawah.
                  </Text>
                </Column>
              </Column>
            ) : (
              <Column
                verticalArrangement={{ spacedBy: 12 }}
                modifiers={[fillMaxWidth()]}
              >
                <Text
                  style={{
                    typography: "labelLarge",
                    fontWeight: "bold",
                    letterSpacing: 0.5,
                  }}
                  color={colors.onSurfaceVariant}
                >
                  {`AKAN DATANG · ${upcoming.length}`}
                </Text>
                {upcoming.map((event) => {
                  const votes = votesByEvent[event.id] ?? [];
                  const attendingUsers = votes
                    .filter((v) => v.is_attending)
                    .map((v) => users[v.user_id])
                    .filter((u): u is UserRow => !!u);
                  const decliningCount = votes.filter(
                    (v) => !v.is_attending,
                  ).length;
                  const isVoting = votingId === event.id;
                  const myVote = myVotes[event.id];
                  const isCreator = event.creator_id === user?.id;
                  const remaining = Math.max(0, totalMembers - votes.length);

                  return (
                    <Card
                      key={event.id}
                      colors={{ containerColor: colors.surfaceContainerLow }}
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
                        <Column verticalArrangement={{ spacedBy: 2 }}>
                          <Text
                            style={{
                              typography: "bodyLarge",
                              fontWeight: "600",
                            }}
                            color={colors.onSurface}
                          >
                            {event.name}
                          </Text>
                          <Text
                            style={{ typography: "labelMedium" }}
                            color={colors.onSurfaceVariant}
                          >
                            {`Dibuat ${firstName(users[event.creator_id]?.fullname ?? "Seseorang")}`}
                          </Text>
                        </Column>

                        <Row
                          verticalAlignment="center"
                          horizontalArrangement={{ spacedBy: 6 }}
                        >
                          <Icon
                            source={LocationOn}
                            tint={colors.onSurfaceVariant}
                            size={16}
                          />
                          <Text
                            style={{ typography: "bodyMedium" }}
                            color={colors.onSurfaceVariant}
                          >
                            {event.location}
                          </Text>
                        </Row>
                        <Row
                          verticalAlignment="center"
                          horizontalArrangement={{ spacedBy: 6 }}
                        >
                          <Icon
                            source={Schedule}
                            tint={colors.onSurfaceVariant}
                            size={16}
                          />
                          <Text
                            style={{ typography: "bodyMedium" }}
                            color={colors.onSurfaceVariant}
                          >
                            {formatEventDateTime(event.event_time)}
                          </Text>
                        </Row>

                        <Row
                          modifiers={[
                            fillMaxWidth(),
                            height(6),
                            clip(Shapes.RoundedCorner(3)),
                            background(colors.surfaceContainerHighest),
                          ]}
                        >
                          {attendingUsers.length > 0 && (
                            <Box
                              modifiers={[
                                weight(attendingUsers.length),
                                fillMaxHeight(),
                                background(colors.primary),
                              ]}
                            />
                          )}
                          {decliningCount > 0 && (
                            <Box
                              modifiers={[
                                weight(decliningCount),
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

                        {(attendingUsers.length > 0 || decliningCount > 0) && (
                          <Row
                            verticalAlignment="center"
                            horizontalArrangement={{ spacedBy: 6 }}
                          >
                            {attendingUsers.length > 0 && (
                              <Row horizontalArrangement={{ spacedBy: -8 }}>
                                {attendingUsers.slice(0, 4).map((u) => (
                                  <VoterAvatar
                                    key={u.id}
                                    user={u}
                                    diameter={24}
                                  />
                                ))}
                              </Row>
                            )}
                            <Text
                              style={{ typography: "labelMedium" }}
                              color={colors.onSurfaceVariant}
                            >
                              {`${attendingUsers.length} ikut${decliningCount > 0 ? ` · ${decliningCount} tidak ikut` : ""}`}
                            </Text>
                          </Row>
                        )}

                        <Row
                          verticalAlignment="center"
                          horizontalArrangement={{ spacedBy: 12 }}
                          modifiers={[fillMaxWidth()]}
                        >
                          {myVote === false ? (
                            <Button
                              enabled={!isVoting}
                              onClick={() => handleVote(event, false)}
                              modifiers={[weight(1)]}
                            >
                              <Text
                                style={{
                                  typography: "labelLarge",
                                  fontWeight: "bold",
                                }}
                                color={colors.onPrimary}
                              >
                                Tidak ikut
                              </Text>
                            </Button>
                          ) : (
                            <OutlinedButton
                              enabled={!isVoting}
                              onClick={() => handleVote(event, false)}
                              modifiers={[weight(1)]}
                            >
                              <Text
                                style={{ typography: "labelLarge" }}
                                color={colors.primary}
                              >
                                Tidak ikut
                              </Text>
                            </OutlinedButton>
                          )}
                          {myVote === true ? (
                            <Button
                              enabled={!isVoting}
                              onClick={() => handleVote(event, true)}
                              modifiers={[weight(1)]}
                            >
                              <Text
                                style={{
                                  typography: "labelLarge",
                                  fontWeight: "bold",
                                }}
                                color={colors.onPrimary}
                              >
                                Ikut
                              </Text>
                            </Button>
                          ) : (
                            <OutlinedButton
                              enabled={!isVoting}
                              onClick={() => handleVote(event, true)}
                              modifiers={[weight(1)]}
                            >
                              <Text
                                style={{ typography: "labelLarge" }}
                                color={colors.primary}
                              >
                                Ikut
                              </Text>
                            </OutlinedButton>
                          )}
                        </Row>

                        {isCreator &&
                          attendingUsers.length > 0 &&
                          (() => {
                            const cooldown = cooldownRemaining(
                              remindedAt[event.id] ?? null,
                            );
                            const isReminding = remindingId === event.id;
                            return (
                              <OutlinedButton
                                enabled={cooldown === 0 && !isReminding}
                                onClick={() =>
                                  handleRemindAttendees(event, attendingUsers)
                                }
                                modifiers={[fillMaxWidth()]}
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
                                      : "Ingatkan yang ikut"}
                                  </Text>
                                </Row>
                              </OutlinedButton>
                            );
                          })()}
                      </Column>
                    </Card>
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
              Buat Event
            </Text>
          </ExtendedFloatingActionButton.Text>
        </ExtendedFloatingActionButton>
      </Box>

      {historyOpen && (
        <ModalBottomSheet onDismissRequest={() => setHistoryOpen(false)}>
          <Column
            verticalArrangement={{ spacedBy: 4 }}
            modifiers={[
              fillMaxWidth(),
              verticalScroll(),
              padding(24, 8, 24, 32),
            ]}
          >
            <Text
              style={{ typography: "headlineSmall", fontWeight: "bold" }}
              color={colors.onSurface}
            >
              Riwayat event
            </Text>
            <Column
              modifiers={[padding(0, 8, 0, 0)]}
              verticalArrangement={{ spacedBy: 4 }}
            >
              {pastRelevant.length === 0 && (
                <Text
                  style={{ typography: "bodyMedium" }}
                  color={colors.onSurfaceVariant}
                >
                  Belum ada riwayat event yang kamu ikuti.
                </Text>
              )}
              {pastRelevant.map((event, i) => {
                const votes = votesByEvent[event.id] ?? [];
                const attendingCount = votes.filter(
                  (v) => v.is_attending,
                ).length;
                const decliningCount = votes.filter(
                  (v) => !v.is_attending,
                ).length;
                return (
                  <Column key={event.id}>
                    <Column
                      verticalArrangement={{ spacedBy: 2 }}
                      modifiers={[padding(0, 12, 0, 12)]}
                    >
                      <Text
                        style={{ typography: "bodyMedium" }}
                        color={colors.onSurface}
                      >
                        {event.name}
                      </Text>
                      <Text
                        style={{ typography: "labelMedium" }}
                        color={colors.onSurfaceVariant}
                      >
                        {`${event.location} · ${formatEventDateTime(event.event_time)}`}
                      </Text>
                      <Text
                        style={{ typography: "labelMedium" }}
                        color={colors.onSurfaceVariant}
                      >
                        {`${attendingCount} ikut · ${decliningCount} tidak ikut`}
                      </Text>
                    </Column>
                    {i < pastRelevant.length - 1 && (
                      <HorizontalDivider color={colors.outlineVariant} />
                    )}
                  </Column>
                );
              })}
            </Column>
          </Column>
        </ModalBottomSheet>
      )}

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
                Buat acara baru
              </Text>
              <Text
                style={{ typography: "bodyMedium" }}
                color={colors.onSurfaceVariant}
              >
                Anggota lain akan diberi tahu dan bisa vote ikut atau tidak.
              </Text>
            </Column>

            <OutlinedTextField
              onValueChange={setName}
              singleLine
              keyboardOptions={{ capitalization: "sentences" }}
              modifiers={[fillMaxWidth()]}
            >
              <OutlinedTextField.Label>
                <Text>Nama acara</Text>
              </OutlinedTextField.Label>
            </OutlinedTextField>

            <OutlinedTextField
              onValueChange={setLocation}
              singleLine
              keyboardOptions={{ capitalization: "sentences" }}
              modifiers={[fillMaxWidth()]}
            >
              <OutlinedTextField.Label>
                <Text>Lokasi</Text>
              </OutlinedTextField.Label>
            </OutlinedTextField>

            <Row
              horizontalArrangement={{ spacedBy: 12 }}
              modifiers={[fillMaxWidth()]}
            >
              <OutlinedButton
                onClick={() => setDatePickerOpen(true)}
                modifiers={[weight(1)]}
              >
                <Text
                  style={{ typography: "labelLarge" }}
                  color={colors.primary}
                >
                  {pickedDate
                    ? pickedDate.toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })
                    : "Pilih tanggal"}
                </Text>
              </OutlinedButton>
              <OutlinedButton
                onClick={() => setTimePickerOpen(true)}
                modifiers={[weight(1)]}
              >
                <Text
                  style={{ typography: "labelLarge" }}
                  color={colors.primary}
                >
                  {pickedDate
                    ? pickedDate.toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Pilih waktu"}
                </Text>
              </OutlinedButton>
            </Row>

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

      {datePickerOpen && (
        <DatePickerDialog
          initialDate={(pickedDate ?? pickerNow).toISOString()}
          onDateSelected={(d) => {
            setPickedDate((prev) => mergeDatePart(prev, d));
            setDatePickerOpen(false);
          }}
          onDismissRequest={() => setDatePickerOpen(false)}
        />
      )}
      {timePickerOpen && (
        <TimePickerDialog
          initialDate={(pickedDate ?? pickerNow).toISOString()}
          onDateSelected={(d) => {
            setPickedDate((prev) => mergeTimePart(prev, d));
            setTimePickerOpen(false);
          }}
          onDismissRequest={() => setTimePickerOpen(false)}
        />
      )}
    </Host>
  );
}
