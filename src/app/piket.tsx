import { AppHost, useAppColors } from "@/components/AppHost";
import { Avatar, avatarColorFor } from "@/components/Avatar";
import { ButtonContent } from "@/components/ButtonContent";
import { FormField } from "@/components/FormField";
import { FormSheet, SheetActions } from "@/components/FormSheet";
import { CardLabel } from "@/components/SettingsCard";
import { piketRequestsApi, piketsApi, usersApi } from "@/services/api";
import { useAuth } from "@/utils/auth-context";
import { useHideOnScroll } from "@/utils/tab-action";
import { horizontalScrollFromEnd } from "../../modules/scroll-reporter";
import { sendPush } from "@/utils/notifications";
import {
  buildDateStrip,
  filterMineDays,
  findNextMine,
  getTodayStr,
  groupByDay,
  pastDays,
  parseDay,
  relativeDay,
} from "@/utils/piket-utils";
import type { Database } from "@/utils/supabase-types";
import { captureAndUploadImage } from "@/utils/upload";
import Check from "@expo/material-symbols/check.xml";
import Close from "@expo/material-symbols/close.xml";
import {
  Button,
  Card,
  Column,
  FilledTonalButton,
  FilterChip,
  Icon,
  IconButton,
  PullToRefreshBox,
  Row,
  Shape,
  Text,
} from "@expo/ui/jetpack-compose";
import {
  background,
  clickable,
  clip,
  fillMaxSize,
  fillMaxWidth,
  horizontalScroll,
  padding,
  paddingAll,
  selectable,
  Shapes,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useEffect, useState } from "react";

type PiketRow = Database["public"]["Tables"]["pikets"]["Row"];
type PiketRequestRow = Database["public"]["Tables"]["piket_requests"]["Row"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];

const STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu",
  done: "Selesai",
  absent: "Absen",
  izin: "Izin",
};
const REQUEST_STATUS: Record<string, string> = {
  pending: "Menunggu",
  accepted: "Diterima",
  declined: "Ditolak",
};
const STRIP_DAYS = 21;
const fmtDay = (day: string, opts: Intl.DateTimeFormatOptions) =>
  parseDay(day).toLocaleDateString("id-ID", opts);

export default function PiketScreen() {
  const hideOnScroll = useHideOnScroll();
  const { user: currentUser } = useAuth();
  const colors = useAppColors();

  const [pikets, setPikets] = useState<PiketRow[]>([]);
  const [users, setUsers] = useState<Record<string, UserRow>>({});
  const [requests, setRequests] = useState<PiketRequestRow[]>([]);
  const [myRequests, setMyRequests] = useState<PiketRequestRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [view, setView] = useState<"all" | "mine" | "history">("all");
  const [selectedDay, setSelectedDay] = useState(getTodayStr());

  const [izinPiket, setIzinPiket] = useState<PiketRow | null>(null);
  const [reason, setReason] = useState("");
  const [replacementId, setReplacementId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [currentUser?.id]);

  async function loadData() {
    const [piketRes, userRes, reqRes] = await Promise.all([
      piketsApi.getAll(),
      usersApi.getAll(),
      piketRequestsApi.getAll(),
    ]);
    setUsers(Object.fromEntries((userRes.data ?? []).map((u) => [u.id, u])));
    setPikets(piketRes.data ?? []);
    const allRequests = reqRes.data ?? [];
    setRequests(
      allRequests.filter(
        (r) => r.assign_to === currentUser?.id && r.status === "pending",
      ),
    );
    setMyRequests(
      allRequests
        .filter((r) => r.requested_by === currentUser?.id)
        .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")),
    );
  }

  const onRefresh = () => {
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  };

  const todayStr = getTodayStr();
  const byDay = groupByDay(pikets);
  const allDays = buildDateStrip(todayStr, STRIP_DAYS);
  const stripDays =
    view === "history"
      ? pastDays(byDay, todayStr)
      : view === "mine"
        ? filterMineDays(
            Object.keys(byDay)
              .sort()
              .filter((d) => d >= todayStr),
            byDay,
            currentUser?.id,
          )
        : allDays;
  // History opens on its newest day (the right end); other views on the first.
  const shownDay = stripDays.includes(selectedDay)
    ? selectedDay
    : view === "history"
      ? stripDays[stripDays.length - 1]
      : stripDays[0];
  const dayPikets = shownDay ? (byDay[shownDay] ?? []) : [];
  // My izin requests: pending ones always, the full history in Riwayat.
  const shownRequests =
    view === "history"
      ? myRequests
      : myRequests.filter((r) => r.status === "pending");
  const myNext = findNextMine(pikets, currentUser?.id, todayStr);
  const otherMembers = Object.values(users).filter(
    (u) => u.id !== currentUser?.id && u.role !== "admin",
  );

  async function handleFinishPiket(piket: PiketRow) {
    setFinishing(true);
    try {
      const url = await captureAndUploadImage(
        "piket-evidence",
        currentUser?.id ?? "anon",
      );
      if (!url) return;
      const { error } = await piketsApi.update(piket.id, {
        status: "done",
        finished: true,
        docs: url,
      });
      if (error) throw error;
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setFinishing(false);
    }
  }

  async function handleRespondRequest(req: PiketRequestRow, accept: boolean) {
    try {
      const { error: reqError } = await piketRequestsApi.update(req.id, {
        status: accept ? "accepted" : "declined",
      });
      if (reqError) throw reqError;

      if (accept && req.piket_id) {
        const { error: piketError } = await piketsApi.update(req.piket_id, {
          assign_to: currentUser!.id,
          status: "izin",
        });
        if (piketError) throw piketError;
      }
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  // The other person on duty that day can't take over (they're already there).
  const izinPartnerId = izinPiket
    ? (byDay[izinPiket.day] ?? []).find((p) => p.id !== izinPiket.id)?.assign_to
    : undefined;

  const closeIzin = () => {
    setIzinPiket(null);
    setReason("");
    setReplacementId(null);
  };

  async function handleSubmitIzin() {
    if (!izinPiket || !replacementId) {
      alert("Pilih penghuni pengganti.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await piketRequestsApi.create({
        piket_id: izinPiket.id,
        assign_to: replacementId,
        reason,
        status: "pending",
      });
      if (error) throw error;

      const replacement = users[replacementId];
      if (replacement) {
        await sendPush({
          recipients: [replacement.id],
          type: "piket",
          title: "Permintaan Tukar Piket",
          body: `${currentUser?.fullname} meminta kamu menggantikan piket tanggal ${fmtDay(izinPiket.day, { day: "numeric", month: "long" })}.`,
        });
      }

      closeIzin();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const sectionTitle = (label: string) => (
    <Text
      style={{ typography: "titleMedium", fontWeight: "bold" }}
      color={colors.onBackground}
    >
      {label}
    </Text>
  );

  return (
    <AppHost style={{ flex: 1 }}>
      <PullToRefreshBox
        isRefreshing={refreshing}
        onRefresh={onRefresh}
        contentAlignment="topCenter"
        modifiers={[fillMaxSize(), background(colors.background)]}
      >
        <Column
          verticalArrangement={{ spacedBy: 20 }}
          modifiers={[fillMaxSize(), hideOnScroll, padding(16, 56, 16, 120)]}
        >
          <Row
            horizontalArrangement="spaceBetween"
            verticalAlignment="center"
            modifiers={[fillMaxWidth()]}
          >
            <Text
              style={{ typography: "headlineMedium", fontWeight: "bold" }}
              color={colors.onBackground}
            >
              Piket
            </Text>
            <Row horizontalArrangement={{ spacedBy: 8 }}>
              {(
                [
                  ["Semua", "all"],
                  ["Punyaku", "mine"],
                  ["Riwayat", "history"],
                ] as const
              ).map(([label, value]) => (
                <FilterChip
                  key={value}
                  selected={view === value}
                  onClick={() => setView(value)}
                >
                  <FilterChip.Label>
                    <Text>{label}</Text>
                  </FilterChip.Label>
                </FilterChip>
              ))}
            </Row>
          </Row>

          {/* Piket kamu berikutnya */}
          <Card
            colors={{
              containerColor: myNext
                ? colors.tertiaryContainer
                : colors.surfaceContainerLow,
            }}
            modifiers={[
              fillMaxWidth(),
              clip(Shapes.RoundedCorner(24)),
              clickable(
                () => myNext && (setView("all"), setSelectedDay(myNext.day)),
              ),
            ]}
          >
            <Column
              verticalArrangement={{ spacedBy: 2 }}
              modifiers={[fillMaxWidth(), paddingAll(16)]}
            >
              <Text
                style={{ typography: "labelLarge", fontWeight: "bold" }}
                color={
                  myNext ? colors.onTertiaryContainer : colors.onSurfaceVariant
                }
              >
                Piket kamu berikutnya
              </Text>
              <Text
                style={{
                  typography: myNext ? "titleLarge" : "bodyMedium",
                  fontWeight: myNext ? "bold" : "400",
                }}
                color={
                  myNext ? colors.onTertiaryContainer : colors.onSurfaceVariant
                }
              >
                {myNext
                  ? `${relativeDay(myNext.day, todayStr)} · ${fmtDay(myNext.day, { weekday: "long", day: "numeric", month: "long" })}`
                  : "Belum ada giliran mendatang untukmu."}
              </Text>
            </Column>
          </Card>

          {/* Permintaan masuk */}
          {requests.length > 0 && (
            <Column verticalArrangement={{ spacedBy: 12 }}>
              {sectionTitle(`Permintaan masuk · ${requests.length}`)}
              {requests.map((req) => {
                const requester =
                  users[
                    req.requested_by ??
                      pikets.find((p) => p.id === req.piket_id)?.assign_to ??
                      ""
                  ];
                const name = requester?.fullname.split(" ")[0] ?? "Seseorang";
                return (
                  <Card
                    key={req.id}
                    colors={{ containerColor: colors.surfaceContainerLow }}
                    modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(18))]}
                  >
                    <Row
                      verticalAlignment="center"
                      horizontalArrangement={{ spacedBy: 12 }}
                      modifiers={[paddingAll(16)]}
                    >
                      <Avatar
                        fullname={name}
                        avatarUrl={requester?.avatar_url}
                        diameter={40}
                        colors={avatarColorFor(requester?.id ?? name, colors)}
                      />
                      <Column
                        verticalArrangement={{ spacedBy: 2 }}
                        modifiers={[weight(1)]}
                      >
                        <Text
                          style={{ typography: "bodyMedium" }}
                          color={colors.onSurface}
                        >
                          <Text
                            style={{ fontWeight: "700" }}
                            color={colors.onSurface}
                          >
                            {name}
                          </Text>
                          {" minta kamu ganti piket"}
                        </Text>
                        {req.reason && (
                          <Text
                            style={{
                              typography: "bodySmall",
                              fontStyle: "italic",
                            }}
                            color={colors.onSurfaceVariant}
                          >
                            {`"${req.reason}"`}
                          </Text>
                        )}
                      </Column>
                      <IconButton
                        shape={Shape.Circle({ radius: 1 })}
                        colors={{
                          containerColor: colors.primary,
                          contentColor: colors.onPrimary,
                        }}
                        onClick={() => handleRespondRequest(req, true)}
                      >
                        <Icon
                          source={Check}
                          tint={colors.onPrimary}
                          size={18}
                        />
                      </IconButton>
                      <IconButton
                        shape={Shape.Circle({ radius: 1 })}
                        colors={{
                          containerColor: colors.surfaceContainerHighest,
                        }}
                        onClick={() => handleRespondRequest(req, false)}
                      >
                        <Icon
                          source={Close}
                          tint={colors.onSurfaceVariant}
                          size={18}
                        />
                      </IconButton>
                    </Row>
                  </Card>
                );
              })}
            </Column>
          )}

          {/* Permintaan izinmu: pending ones always, everything in Riwayat */}
          {shownRequests.length > 0 && (
            <Column verticalArrangement={{ spacedBy: 8 }}>
              {sectionTitle("Permintaan izinmu")}
              {shownRequests.map((req) => {
                const day = pikets.find((p) => p.id === req.piket_id)?.day;
                const replacement = users[req.assign_to ?? ""];
                const pending = req.status === "pending";
                return (
                  <Row
                    key={req.id}
                    verticalAlignment="center"
                    horizontalArrangement={{ spacedBy: 12 }}
                    modifiers={[
                      fillMaxWidth(),
                      clip(Shapes.RoundedCorner(16)),
                      background(colors.surfaceContainerLow),
                      paddingAll(14),
                    ]}
                  >
                    <Column
                      verticalArrangement={{ spacedBy: 2 }}
                      modifiers={[weight(1)]}
                    >
                      <Text
                        style={{
                          typography: "bodyMedium",
                          fontWeight: "bold",
                        }}
                        color={colors.onSurface}
                      >
                        {day
                          ? fmtDay(day, {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                            })
                          : "Piket"}
                      </Text>
                      <Text
                        style={{ typography: "bodySmall" }}
                        color={colors.onSurfaceVariant}
                      >
                        {`Pengganti: ${replacement?.fullname.split(" ")[0] ?? "-"}`}
                      </Text>
                    </Column>
                    <Text
                      style={{
                        typography: "labelMedium",
                        fontWeight: "bold",
                      }}
                      color={
                        pending
                          ? colors.onSecondaryContainer
                          : req.status === "accepted"
                            ? colors.primary
                            : colors.error
                      }
                      modifiers={[
                        clip(Shapes.RoundedCorner(12)),
                        background(
                          pending
                            ? colors.secondaryContainer
                            : colors.surfaceContainerHigh,
                        ),
                        padding(10, 4, 10, 4),
                      ]}
                    >
                      {REQUEST_STATUS[req.status] ?? req.status}
                    </Text>
                  </Row>
                );
              })}
            </Column>
          )}

          {/* Date strip */}
          <Row
            horizontalArrangement={{ spacedBy: 8 }}
            key={view}
            modifiers={[
              fillMaxWidth(),
              view === "history"
                ? horizontalScrollFromEnd()
                : horizontalScroll(),
            ]}
          >
            {stripDays.map((day) => {
              const sel = day === shownDay;
              const mine =
                filterMineDays([day], byDay, currentUser?.id).length > 0;
              const isToday = day === todayStr;
              const fg = sel
                ? colors.onPrimary
                : isToday
                  ? colors.onSecondaryContainer
                  : colors.onSurface;
              return (
                <Column
                  key={day}
                  horizontalAlignment="center"
                  verticalArrangement={{ spacedBy: 2 }}
                  modifiers={[
                    clip(Shapes.RoundedCorner(16)),
                    // Today keeps a darker fill (like a selected chip) when not selected.
                    background(
                      sel
                        ? colors.primary
                        : isToday
                          ? colors.secondaryContainer
                          : mine
                            ? colors.tertiaryContainer
                            : colors.surfaceContainerLow,
                    ),
                    clickable(() => setSelectedDay(day)),
                    padding(14, 10, 14, 10),
                  ]}
                >
                  <Text style={{ typography: "labelMedium" }} color={fg}>
                    {day === todayStr
                      ? "Hari ini"
                      : fmtDay(day, { weekday: "short" })}
                  </Text>
                  <Text
                    style={{ typography: "titleLarge", fontWeight: "bold" }}
                    color={fg}
                  >
                    {String(parseDay(day).getDate())}
                  </Text>
                </Column>
              );
            })}
          </Row>

          {/* Day detail */}
          <Column verticalArrangement={{ spacedBy: 12 }}>
            {shownDay &&
              sectionTitle(
                fmtDay(shownDay, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }),
              )}
            {dayPikets.length === 0 && (
              <Text
                style={{ typography: "bodyMedium" }}
                color={colors.onSurfaceVariant}
              >
                {view === "history"
                  ? "Belum ada riwayat piket."
                  : view === "mine"
                    ? "Tidak ada giliran piket untukmu."
                    : "Belum ada jadwal piket hari ini."}
              </Text>
            )}
            {dayPikets.map((p) => {
              const person = users[p.assign_to ?? ""];
              const isMe = p.assign_to === currentUser?.id;
              // Past days are history: no finishing or swapping anymore.
              const canAct = isMe && p.status !== "done" && p.day >= todayStr;
              return (
                <Card
                  key={p.id}
                  // Your own entry gets an even 1dp outline: the card is filled
                  // with the theme colour and the content sits 1dp inside it on
                  // the normal background, with matching corners.
                  colors={{
                    containerColor: isMe
                      ? colors.primary
                      : colors.surfaceContainerLow,
                  }}
                  modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(18))]}
                >
                  <Column
                    verticalArrangement={{ spacedBy: 12 }}
                    modifiers={
                      isMe
                        ? [
                            paddingAll(1),
                            clip(Shapes.RoundedCorner(17)),
                            background(colors.surfaceContainerLow),
                            paddingAll(15),
                          ]
                        : [paddingAll(16)]
                    }
                  >
                    <Row
                      verticalAlignment="center"
                      horizontalArrangement={{ spacedBy: 12 }}
                    >
                      <Avatar
                        fullname={person?.fullname ?? "-"}
                        avatarUrl={person?.avatar_url}
                        diameter={40}
                        colors={avatarColorFor(p.assign_to ?? "-", colors)}
                      />
                      <Row
                        verticalAlignment="center"
                        horizontalArrangement={{ spacedBy: 8 }}
                        modifiers={[weight(1)]}
                      >
                        <Text
                          style={{
                            typography: "titleMedium",
                            fontWeight: "bold",
                          }}
                          color={colors.onSurface}
                          maxLines={1}
                          overflow="ellipsis"
                        >
                          {person?.fullname ?? "-"}
                        </Text>
                        {isMe ? (
                          <Text
                            style={{
                              typography: "labelSmall",
                              fontWeight: "bold",
                            }}
                            color={colors.onPrimary}
                            modifiers={[
                              clip(Shapes.RoundedCorner(8)),
                              background(colors.primary),
                              padding(8, 2, 8, 2),
                            ]}
                          >
                            Kamu
                          </Text>
                        ) : null}
                      </Row>
                      <Text
                        style={{ typography: "labelLarge" }}
                        color={colors.onSurfaceVariant}
                      >
                        {STATUS_LABEL[p.status] ?? p.status}
                      </Text>
                    </Row>
                    {canAct && (
                      <Row
                        horizontalArrangement={{ spacedBy: 8 }}
                        modifiers={[fillMaxWidth()]}
                      >
                        {p.day === todayStr && (
                          <Button
                            enabled={!finishing}
                            onClick={() => handleFinishPiket(p)}
                            modifiers={[weight(1)]}
                          >
                            <ButtonContent
                              loading={finishing}
                              label="Selesaikan"
                              color={colors.onPrimary}
                            />
                          </Button>
                        )}
                        <FilledTonalButton
                          onClick={() => setIzinPiket(p)}
                          modifiers={[weight(1)]}
                        >
                          <Text
                            style={{ typography: "labelLarge" }}
                            color={colors.onSurface}
                          >
                            Minta izin
                          </Text>
                        </FilledTonalButton>
                      </Row>
                    )}
                  </Column>
                </Card>
              );
            })}
          </Column>
        </Column>
      </PullToRefreshBox>

      {/* Minta izin sheet */}
      {izinPiket && (
        <FormSheet
          title="Minta izin piket"
          subtitle={fmtDay(izinPiket.day, { weekday: "long", day: "numeric", month: "long" })}
          onClose={closeIzin}
        >
          <CardLabel>Siapa yang menggantikan?</CardLabel>
          <Column verticalArrangement={{ spacedBy: 8 }}>
            {otherMembers.map((m) => {
              const selected = replacementId === m.id;
              const isPartner = izinPartnerId === m.id;
              const next = findNextMine(pikets, m.id, todayStr)?.day;
              return (
                <Row
                  key={m.id}
                  verticalAlignment="center"
                  horizontalArrangement={{ spacedBy: 12 }}
                  modifiers={[
                    fillMaxWidth(),
                    clip(Shapes.RoundedCorner(16)),
                    background(selected ? colors.secondaryContainer : colors.surfaceContainerLow),
                    ...(isPartner ? [] : [selectable(selected, () => setReplacementId(m.id), "radioButton")]),
                    paddingAll(12),
                  ]}
                >
                  <Avatar
                    fullname={m.fullname}
                    avatarUrl={m.avatar_url}
                    diameter={44}
                    colors={avatarColorFor(m.id, colors)}
                  />
                  <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[weight(1)]}>
                    <Text
                      style={{ typography: "bodyLarge", fontWeight: "bold" }}
                      color={isPartner ? colors.onSurfaceVariant : selected ? colors.onSecondaryContainer : colors.onSurface}
                    >
                      {m.fullname}
                    </Text>
                    <Text
                      style={{ typography: "bodySmall" }}
                      color={selected ? colors.onSecondaryContainer : colors.onSurfaceVariant}
                    >
                      {isPartner
                        ? "Sudah piket bareng kamu hari itu"
                        : next
                          ? `Piket berikutnya ${relativeDay(next, todayStr).toLowerCase()}`
                          : "Belum ada jadwal piket"}
                    </Text>
                  </Column>
                  {selected && <Icon source={Check} tint={colors.onSecondaryContainer} size={24} />}
                </Row>
              );
            })}
          </Column>

          <FormField
            label="Alasan (opsional)"
            onValueChange={setReason}
            minLines={2}
            keyboardOptions={{ capitalization: "sentences" }}
          />

          <SheetActions
            onCancel={closeIzin}
            onSubmit={handleSubmitIzin}
            submitLabel="Ajukan"
            enabled={!!replacementId}
            loading={submitting}
          />
        </FormSheet>
      )}
    </AppHost>
  );
}
