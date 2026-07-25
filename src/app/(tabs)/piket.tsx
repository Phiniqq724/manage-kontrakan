import { ButtonContent } from "@/components/ButtonContent";
import { piketRequestsApi, piketsApi, usersApi } from "@/services/api";
import { useAuth } from "@/utils/auth-context";
import { sendPushNotification } from "@/utils/notifications";
import { getTodayStr } from "@/utils/piket-utils";
import type { Database } from "@/utils/supabase-types";
import { captureAndUploadImage } from "@/utils/upload";
import Check from "@expo/material-symbols/check.xml";
import Close from "@expo/material-symbols/close.xml";
import History from "@expo/material-symbols/history.xml";
import SwapHoriz from "@expo/material-symbols/swap_horiz.xml";
import { Host } from "@expo/ui";
import {
  Box,
  Button,
  Card,
  Column,
  FilledTonalButton,
  HorizontalDivider,
  Icon,
  IconButton,
  ModalBottomSheet,
  OutlinedButton,
  OutlinedCard,
  OutlinedTextField,
  PullToRefreshBox,
  RadioButton,
  Row,
  Shape,
  Text,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  background,
  clip,
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

type PiketRow = Database["public"]["Tables"]["pikets"]["Row"];
type PiketRequestRow = Database["public"]["Tables"]["piket_requests"]["Row"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];

const STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu",
  done: "Selesai",
  absent: "Absen",
  izin: "Izin",
};

function firstName(fullname: string) {
  return fullname.split(" ")[0] ?? fullname;
}

function relativeDay(dayStr: string, todayStr: string) {
  const diff = Math.round(
    (new Date(dayStr).getTime() - new Date(todayStr).getTime()) / 86400000,
  );
  if (diff <= 0) return "Hari ini";
  if (diff === 1) return "Besok";
  return `${diff} hari lagi`;
}

export default function PiketScreen() {
  const { user: currentUser } = useAuth();
  const colors = useMaterialColors();

  const [pikets, setPikets] = useState<PiketRow[]>([]);
  const [users, setUsers] = useState<Record<string, UserRow>>({});
  const [pendingRequests, setPendingRequests] = useState<PiketRequestRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [izinOpen, setIzinOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [selectedReplacementId, setSelectedReplacementId] = useState<
    string | null
  >(null);
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

    const userMap: Record<string, UserRow> = {};
    (userRes.data ?? []).forEach((u) => {
      userMap[u.id] = u;
    });
    setUsers(userMap);

    const allPikets = (piketRes.data ?? []).sort(
      (a, b) => new Date(b.day).getTime() - new Date(a.day).getTime(),
    );
    setPikets(allPikets);

    if (currentUser) {
      const pending = (reqRes.data ?? []).filter(
        (r) => r.assign_to === currentUser.id && r.status === "pending",
      );
      setPendingRequests(pending);
    }
  }

  const onRefresh = () => {
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  };

  const todayStr = getTodayStr();
  const myNextPiket =
    pikets
      .filter(
        (p) =>
          p.assign_to === currentUser?.id &&
          p.day >= todayStr &&
          p.status !== "done",
      )
      .sort(
        (a, b) => new Date(a.day).getTime() - new Date(b.day).getTime(),
      )[0] ?? null;

  const otherMembers = Object.values(users).filter(
    (u) => u.id !== currentUser?.id && u.role !== "admin",
  );

  const upcomingGroups: { day: string; group: PiketRow[] }[] = (() => {
    const map: Record<string, PiketRow[]> = {};
    pikets
      .filter((p) => p.day >= todayStr)
      .forEach((p) => {
        (map[p.day] ??= []).push(p);
      });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, group]) => ({ day, group }));
  })();

  const pastGroups: { day: string; group: PiketRow[] }[] = (() => {
    const map: Record<string, PiketRow[]> = {};
    pikets
      .filter((p) => p.day < todayStr)
      .forEach((p) => {
        (map[p.day] ??= []).push(p);
      });
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([day, group]) => ({ day, group }));
  })();

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

  async function handleSubmitIzin() {
    if (!myNextPiket || !selectedReplacementId) {
      alert("Pilih penghuni pengganti.");
      return;
    }
    const partner = pikets.find(
      (p) => p.day === myNextPiket.day && p.id !== myNextPiket.id,
    );
    if (partner?.assign_to === selectedReplacementId) {
      alert(
        "Tidak bisa mengalihkan ke penghuni yang sudah menjadi partnermu di piket ini.",
      );
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await piketRequestsApi.create({
        piket_id: myNextPiket.id,
        assign_to: selectedReplacementId,
        reason,
        status: "pending",
      });
      if (error) throw error;

      const replacement = users[selectedReplacementId];
      if (replacement?.push_token) {
        const piketDate = new Date(myNextPiket.day).toLocaleDateString(
          "id-ID",
          {
            day: "numeric",
            month: "long",
          },
        );
        await sendPushNotification(
          replacement.push_token,
          "Permintaan Tukar Piket",
          `${currentUser?.fullname} meminta kamu menggantikan piket tanggal ${piketDate}.`,
        );
      }

      setIzinOpen(false);
      setReason("");
      setSelectedReplacementId(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const namesLine = (group: PiketRow[]) =>
    group.map((p) => {
      const name = p.assign_to
        ? firstName(users[p.assign_to]?.fullname ?? "-")
        : "-";
      const isMe = p.assign_to === currentUser?.id;
      return { name, isMe };
    });

  return (
    <Host style={{ flex: 1 }}>
      <PullToRefreshBox
        isRefreshing={refreshing}
        onRefresh={onRefresh}
        contentAlignment="topCenter"
        modifiers={[fillMaxSize(), background(colors.background)]}
      >
        <Column
          verticalArrangement={{ spacedBy: 24 }}
          modifiers={[fillMaxSize(), verticalScroll(), padding(16, 56, 16, 32)]}
        >
          {/* Header */}
          <Row
            horizontalArrangement="spaceBetween"
            verticalAlignment="center"
            modifiers={[fillMaxWidth()]}
          >
            <Column verticalArrangement={{ spacedBy: 4 }}>
              <Text
                style={{ typography: "headlineMedium", fontWeight: "bold" }}
                color={colors.onBackground}
              >
                Piket
              </Text>
              {myNextPiket && (
                <Row
                  verticalAlignment="center"
                  horizontalArrangement={{ spacedBy: 4 }}
                >
                  <Icon
                    source={SwapHoriz}
                    tint={colors.onSurfaceVariant}
                    size={16}
                  />
                  <Text
                    style={{ typography: "bodyMedium" }}
                    color={colors.onSurfaceVariant}
                  >
                    {"Giliranmu "}
                    <Text
                      style={{ fontWeight: "700" }}
                      color={colors.onSurface}
                    >
                      {relativeDay(myNextPiket.day, todayStr)}
                    </Text>
                  </Text>
                </Row>
              )}
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

          {/* Hero */}
          {myNextPiket ? (
            <Card
              colors={{ containerColor: colors.tertiaryContainer }}
              modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(24))]}
            >
              <Column
                verticalArrangement={{ spacedBy: 8 }}
                modifiers={[fillMaxWidth(), paddingAll(20)]}
              >
                <Text
                  style={{
                    typography: "labelLarge",
                    fontWeight: "bold",
                    letterSpacing: 0.5,
                  }}
                  color={colors.onTertiaryContainer}
                >
                  {`GILIRAN KAMU · ${relativeDay(myNextPiket.day, todayStr).toUpperCase()}`}
                </Text>
                <Text
                  style={{ typography: "headlineMedium", fontWeight: "bold" }}
                  color={colors.onTertiaryContainer}
                >
                  {new Date(myNextPiket.day).toLocaleDateString("id-ID", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </Text>

                {myNextPiket.day === todayStr && (
                  <Button
                    enabled={!finishing}
                    onClick={() => handleFinishPiket(myNextPiket)}
                    modifiers={[fillMaxWidth()]}
                  >
                    <ButtonContent loading={finishing} label="Selesaikan" color={colors.onPrimary} />
                  </Button>
                )}

                <FilledTonalButton onClick={() => setIzinOpen(true)}>
                  <Text
                    style={{ typography: "labelLarge" }}
                    color={colors.onTertiaryContainer}
                  >
                    Tidak bisa piket? Minta izin
                  </Text>
                </FilledTonalButton>
              </Column>
            </Card>
          ) : (
            <Card
              colors={{ containerColor: colors.surfaceContainerLow }}
              modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(24))]}
            >
              <Text
                style={{ typography: "bodyMedium" }}
                color={colors.onSurfaceVariant}
                modifiers={[paddingAll(20)]}
              >
                Tidak ada giliran piket mendatang untukmu.
              </Text>
            </Card>
          )}

          {/* Permintaan masuk */}
          {pendingRequests.length > 0 && (
            <Column verticalArrangement={{ spacedBy: 12 }}>
              <Text
                style={{ typography: "titleMedium", fontWeight: "bold" }}
                color={colors.onBackground}
              >
                {`Permintaan masuk · ${pendingRequests.length}`}
              </Text>
              {pendingRequests.map((req) => {
                const piket = pikets.find((p) => p.id === req.piket_id);
                const requesterName = piket?.assign_to
                  ? firstName(users[piket.assign_to]?.fullname ?? "Seseorang")
                  : "Seseorang";
                return (
                  <OutlinedCard key={req.id} modifiers={[fillMaxWidth()]}>
                    <Row
                      verticalAlignment="center"
                      horizontalArrangement={{ spacedBy: 12 }}
                      modifiers={[paddingAll(16)]}
                    >
                      <Box
                        contentAlignment="center"
                        modifiers={[
                          size(40, 40),
                          clip(Shapes.RoundedCorner(20)),
                          background(colors.primaryContainer),
                        ]}
                      >
                        <Text
                          style={{
                            typography: "titleMedium",
                            fontWeight: "bold",
                          }}
                          color={colors.onPrimaryContainer}
                        >
                          {requesterName[0]?.toUpperCase() ?? "?"}
                        </Text>
                      </Box>
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
                            {requesterName}
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
                      <Row horizontalArrangement={{ spacedBy: 8 }}>
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
                    </Row>
                  </OutlinedCard>
                );
              })}
            </Column>
          )}

          {/* Jadwal mendatang */}
          <Column verticalArrangement={{ spacedBy: 12 }}>
            <Text
              style={{ typography: "titleMedium", fontWeight: "bold" }}
              color={colors.onBackground}
            >
              Jadwal mendatang
            </Text>
            {upcomingGroups.length === 0 && (
              <Text
                style={{ typography: "bodyMedium" }}
                color={colors.onSurfaceVariant}
              >
                Belum ada jadwal piket mendatang.
              </Text>
            )}
            {upcomingGroups.map(({ day, group }) => {
              const isNext = day === myNextPiket?.day;
              const dateLabel = new Date(day)
                .toLocaleDateString("id-ID", { day: "2-digit", month: "short" })
                .toUpperCase();
              const names = namesLine(group);

              const row = (
                <Row
                  verticalAlignment="center"
                  horizontalArrangement={{ spacedBy: 12 }}
                  modifiers={[paddingAll(16)]}
                >
                  <Text
                    style={{ typography: "labelMedium", fontWeight: "bold" }}
                    color={isNext ? colors.primary : colors.onSurfaceVariant}
                  >
                    {dateLabel}
                  </Text>
                  <Text
                    style={{ typography: "bodyMedium" }}
                    color={colors.onSurface}
                    modifiers={[weight(1)]}
                  >
                    {names.map((n, i) => (
                      <Text key={i}>
                        {i > 0 ? " · " : ""}
                        {n.name}
                        {n.isMe && (
                          <Text
                            style={{ fontWeight: "600" }}
                            color={colors.primary}
                          >
                            {" (kamu)"}
                          </Text>
                        )}
                      </Text>
                    ))}
                  </Text>
                  {isNext ? (
                    <Row
                      modifiers={[
                        clip(Shapes.RoundedCorner(12)),
                        background(colors.primary),
                        padding(10, 4, 10, 4),
                      ]}
                    >
                      <Text
                        style={{ typography: "labelSmall", fontWeight: "bold" }}
                        color={colors.onPrimary}
                      >
                        Giliranmu
                      </Text>
                    </Row>
                  ) : (
                    <Text
                      style={{ typography: "labelMedium" }}
                      color={colors.onSurfaceVariant}
                    >
                      Menunggu
                    </Text>
                  )}
                </Row>
              );

              return isNext ? (
                <Card
                  key={day}
                  colors={{ containerColor: colors.primaryContainer }}
                  modifiers={[fillMaxWidth()]}
                >
                  {row}
                </Card>
              ) : (
                <OutlinedCard key={day} modifiers={[fillMaxWidth()]}>
                  {row}
                </OutlinedCard>
              );
            })}
          </Column>
        </Column>
      </PullToRefreshBox>

      {/* Riwayat sheet */}
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
              Riwayat piket
            </Text>
            <Column
              modifiers={[padding(0, 8, 0, 0)]}
              verticalArrangement={{ spacedBy: 4 }}
            >
              {pastGroups.length === 0 && (
                <Text
                  style={{ typography: "bodyMedium" }}
                  color={colors.onSurfaceVariant}
                >
                  Belum ada riwayat piket.
                </Text>
              )}
              {pastGroups.map(({ day, group }, idx) => {
                const dateLabel = new Date(day)
                  .toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "short",
                  })
                  .toUpperCase();
                const names = namesLine(group);
                const status = group.every((p) => p.status === "done")
                  ? "done"
                  : (group[0]?.status ?? "pending");
                return (
                  <Column key={day}>
                    <Row
                      verticalAlignment="center"
                      horizontalArrangement={{ spacedBy: 12 }}
                      modifiers={[padding(0, 12, 0, 12)]}
                    >
                      <Text
                        style={{
                          typography: "labelMedium",
                          fontWeight: "bold",
                        }}
                        color={colors.onSurfaceVariant}
                      >
                        {dateLabel}
                      </Text>
                      <Text
                        style={{ typography: "bodyMedium" }}
                        color={colors.onSurface}
                        modifiers={[weight(1)]}
                      >
                        {names.map((n) => n.name).join(" · ")}
                      </Text>
                      <Text
                        style={{ typography: "labelMedium" }}
                        color={colors.onSurfaceVariant}
                      >
                        {STATUS_LABEL[status] ?? status}
                      </Text>
                    </Row>
                    {idx < pastGroups.length - 1 && (
                      <HorizontalDivider color={colors.outlineVariant} />
                    )}
                  </Column>
                );
              })}
            </Column>
          </Column>
        </ModalBottomSheet>
      )}

      {/* Minta izin sheet */}
      {izinOpen && (
        <ModalBottomSheet onDismissRequest={() => setIzinOpen(false)}>
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
                Minta izin piket
              </Text>
              {myNextPiket && (
                <Text
                  style={{ typography: "bodyMedium" }}
                  color={colors.onSurfaceVariant}
                >
                  {new Date(myNextPiket.day).toLocaleDateString("id-ID", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </Text>
              )}
            </Column>

            <OutlinedTextField
              onValueChange={setReason}
              keyboardOptions={{ capitalization: "sentences" }}
              modifiers={[fillMaxWidth()]}
            >
              <OutlinedTextField.Label>
                <Text>Alasan</Text>
              </OutlinedTextField.Label>
            </OutlinedTextField>

            <Column verticalArrangement={{ spacedBy: 4 }}>
              <Text
                style={{ typography: "labelLarge", fontWeight: "bold" }}
                color={colors.onSurfaceVariant}
              >
                Ganti ke
              </Text>
              {otherMembers.map((m) => (
                <Row
                  key={m.id}
                  verticalAlignment="center"
                  horizontalArrangement={{ spacedBy: 8 }}
                  modifiers={[
                    clip(Shapes.RoundedCorner(12)),
                    selectable(
                      selectedReplacementId === m.id,
                      () => setSelectedReplacementId(m.id),
                      "radioButton",
                    ),
                    padding(4, 8, 4, 8),
                    fillMaxWidth(),
                  ]}
                >
                  <RadioButton selected={selectedReplacementId === m.id} />
                  <Text
                    style={{ typography: "bodyLarge" }}
                    color={colors.onSurface}
                  >
                    {m.fullname}
                  </Text>
                </Row>
              ))}
            </Column>

            <Button
              enabled={!!selectedReplacementId && !submitting}
              onClick={handleSubmitIzin}
              modifiers={[fillMaxWidth(), height(56)]}
            >
              <ButtonContent
                loading={submitting}
                enabled={!!selectedReplacementId}
                label="Ajukan"
                color={colors.onPrimary}
              />
            </Button>
          </Column>
        </ModalBottomSheet>
      )}
    </Host>
  );
}
