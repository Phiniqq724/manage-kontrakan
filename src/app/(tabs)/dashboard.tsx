import { isPayable, PayFormSheet } from "@/components/PaymentsSheets";
import {
  guestsApi,
  paymentsApi,
  piketsApi,
  ruleRequestsApi,
  ruleRequestVotesApi,
  usersApi,
} from "@/services/api";
import { useAuth } from "@/utils/auth-context";
import { sendPushNotification } from "@/utils/notifications";
import type { Database } from "@/utils/supabase-types";
import BugReport from "@expo/material-symbols/bug_report.xml";
import CheckCircle from "@expo/material-symbols/check_circle.xml";
import ReceiptLong from "@expo/material-symbols/receipt_long.xml";
import Description from "@expo/material-symbols/description.xml";
import Event from "@expo/material-symbols/event.xml";
import Forum from "@expo/material-symbols/forum.xml";
import Notifications from "@expo/material-symbols/notifications.xml";
import PersonAdd from "@expo/material-symbols/person_add.xml";
import Receipt from "@expo/material-symbols/receipt.xml";
import { Host } from "@expo/ui";
import {
  Badge,
  BadgedBox,
  Box,
  Button,
  Card,
  Column,
  Icon,
  IconButton,
  OutlinedButton,
  PullToRefreshBox,
  RNHostView,
  Row,
  Text,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  background,
  clickable,
  clip,
  fillMaxSize,
  fillMaxWidth,
  padding,
  paddingAll,
  Shapes,
  size,
  verticalScroll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import type { ImageSourcePropType } from "react-native";
import { Alert, Image, Pressable } from "react-native";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type PiketRow = Database["public"]["Tables"]["pikets"]["Row"];
type GuestRow = Database["public"]["Tables"]["guests"]["Row"];
type RuleRequestRow = Database["public"]["Tables"]["rule_requests"]["Row"];

type AttentionItem =
  | {
      type: "piket";
      id: string;
      dayAbbr: string;
      dayNum: number;
      subtitle: string;
    }
  | { type: "rule"; id: string; title: string; subtitle: string };

type ActivityItem = {
  id: string;
  icon: ImageSourcePropType;
  text: string;
  highlight: string;
  at: Date;
};

const parseTs = (s: string) =>
  // Date-only values (e.g. `due_date` = "2026-07-10") parse as-is — appending
  // "Z" to them yields an invalid date. Zone-less timestamps are treated as UTC.
  /^\d{4}-\d{2}-\d{2}$/.test(s)
    ? new Date(s)
    : new Date(s.endsWith("Z") ? s : `${s}Z`);
const firstName = (fullname: string) => fullname.split(" ")[0] ?? fullname;

function withAlpha(hex: string, alphaHex: string) {
  return `${hex.slice(0, 7)}${alphaHex}` as typeof hex;
}

function formatRupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function timeAgo(date: Date) {
  const minutes = Math.max(
    0,
    Math.round((Date.now() - date.getTime()) / 60000),
  );
  if (minutes < 1) return "Baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.round(hours / 24);
  return `${days} hari lalu`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Selamat pagi,";
  if (h < 17) return "Selamat siang,";
  return "Selamat malam,";
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const colors = useMaterialColors();

  const [refreshing, setRefreshing] = useState(false);
  const [payment, setPayment] = useState<PaymentRow | null>(null);
  const [payFormOpen, setPayFormOpen] = useState(false);
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (user) loadData();
    }, [user?.id]),
  );

  async function loadData() {
    if (!user) return;
    const [usersRes, piketRes, payRes, guestRes, ruleReqRes, myVotesRes] =
      await Promise.all([
        usersApi.getAll(),
        piketsApi.getAll(),
        paymentsApi.getByUser(user.id),
        guestsApi.getAll(),
        ruleRequestsApi.getAll(),
        ruleRequestVotesApi.getAllMine(user.id),
      ]);

    const usersById = new Map(
      (usersRes.data ?? []).map((u) => [u.id, u.fullname]),
    );
    const nameFor = (id: string | null) =>
      id ? firstName(usersById.get(id) ?? "Seseorang") : "Seseorang";

    const period = new Date().toISOString().slice(0, 7);
    setPayment((payRes.data ?? []).find((p) => p.period === period) ?? null);

    const allPikets: PiketRow[] = piketRes.data ?? [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const myNextPiket = allPikets
      .filter(
        (p) =>
          p.assign_to === user.id &&
          p.status !== "done" &&
          parseTs(p.day) >= today,
      )
      .sort((a, b) => parseTs(a.day).getTime() - parseTs(b.day).getTime())[0];

    const attention: AttentionItem[] = [];
    if (myNextPiket) {
      const partner = allPikets.find(
        (p) =>
          p.day === myNextPiket.day &&
          p.id !== myNextPiket.id &&
          p.assign_to &&
          p.assign_to !== user.id,
      );
      const dateObj = parseTs(myNextPiket.day);
      const diffDays = Math.round(
        (dateObj.getTime() - today.getTime()) / 86400000,
      );
      const when =
        diffDays <= 0
          ? "Hari ini"
          : diffDays === 1
            ? "Besok"
            : `${diffDays} hari lagi`;
      attention.push({
        type: "piket",
        id: myNextPiket.id,
        dayAbbr: dateObj
          .toLocaleDateString("id-ID", { weekday: "short" })
          .toUpperCase(),
        dayNum: dateObj.getDate(),
        subtitle: [
          dateObj.toLocaleDateString("id-ID", {
            weekday: "long",
            day: "numeric",
            month: "long",
          }),
          partner ? `bareng ${nameFor(partner.assign_to)}` : null,
          when,
        ]
          .filter(Boolean)
          .join(" · "),
      });
    }

    const votedIds = new Set(
      (myVotesRes.data ?? []).map((v) => v.rule_request_id),
    );
    const allRuleReqs: RuleRequestRow[] = ruleReqRes.data ?? [];
    const votable = allRuleReqs.filter(
      (r) =>
        r.status === "pending" &&
        r.assign_by !== user.id &&
        !votedIds.has(r.id) &&
        user.role !== "admin",
    );
    votable.slice(0, 2).forEach((r) => {
      attention.push({
        type: "rule",
        id: r.id,
        title: `Usulan aturan dari ${nameFor(r.assign_by)}`,
        subtitle: r.rules,
      } as AttentionItem);
    });
    setAttentionItems(attention);

    const allGuests: GuestRow[] = guestRes.data ?? [];

    const guestActivity: ActivityItem[] = allGuests
      .slice()
      .sort(
        (a, b) => parseTs(b.check_in).getTime() - parseTs(a.check_in).getTime(),
      )
      .slice(0, 3)
      .map((g) => ({
        id: `guest-${g.id}`,
        icon: PersonAdd,
        text: `${nameFor(g.invited_by)} mendaftarkan tamu`,
        highlight: g.name,
        at: parseTs(g.check_in),
      }));

    const doneActivity: ActivityItem[] = allPikets
      .filter((p) => p.status === "done")
      .sort(
        (a, b) =>
          parseTs(b.modified_at ?? b.day).getTime() -
          parseTs(a.modified_at ?? a.day).getTime(),
      )
      .slice(0, 3)
      .map((p) => ({
        id: `piket-${p.id}`,
        icon: CheckCircle,
        text: `${nameFor(p.assign_to)} menyelesaikan`,
        highlight: "piket",
        at: parseTs(p.modified_at ?? p.day),
      }));

    setActivityItems(
      [...guestActivity, ...doneActivity]
        .sort((a, b) => b.at.getTime() - a.at.getTime())
        .slice(0, 4),
    );
  }

  const onRefresh = () => {
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  };

  const sendTestNotification = async () => {
    if (!user?.push_token) {
      Alert.alert(
        "Tidak ada push token",
        "Belum ada push token tersimpan untuk akun ini.",
      );
      return;
    }
    await sendPushNotification(
      user.push_token,
      "Notifikasi tes",
      "Ini notifikasi tes dari dev button.",
    );
    Alert.alert("Terkirim", "Notifikasi tes sudah dikirim.");
  };

  const monthLabel = new Date()
    .toLocaleDateString("id-ID", { month: "long", year: "numeric" })
    .toUpperCase();
  const dueInDays = payment?.due_date
    ? Math.round((parseTs(payment.due_date).getTime() - Date.now()) / 86400000)
    : null;

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
            <Column verticalArrangement={{ spacedBy: 2 }}>
              <Text
                style={{ typography: "bodyMedium" }}
                color={colors.onSurfaceVariant}
              >
                {greeting()}
              </Text>
              <Text
                style={{ typography: "headlineMedium", fontWeight: "bold" }}
                color={colors.onBackground}
              >
                {user?.fullname ? firstName(user.fullname) : ""}
              </Text>
            </Column>
            <Row
              verticalAlignment="center"
              horizontalArrangement={{ spacedBy: 12 }}
            >
              {__DEV__ && (
                <IconButton onClick={sendTestNotification}>
                  <Icon
                    source={BugReport}
                    tint={colors.onSurfaceVariant}
                    size={22}
                  />
                </IconButton>
              )}
              <IconButton onClick={() => router.push("/changelog" as any)}>
                <Icon
                  source={Notifications}
                  tint={colors.onSurfaceVariant}
                  size={22}
                />
              </IconButton>
              {user?.avatar_url ? (
                <Box modifiers={[size(40, 40), clip(Shapes.RoundedCorner(20))]}>
                  <RNHostView>
                    <Pressable onPress={() => router.push("/profile" as any)}>
                      <Image
                        source={{ uri: user.avatar_url }}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode="cover"
                      />
                    </Pressable>
                  </RNHostView>
                </Box>
              ) : (
                <Box
                  contentAlignment="center"
                  modifiers={[
                    size(40, 40),
                    clip(Shapes.RoundedCorner(20)),
                    background(colors.primaryContainer),
                    clickable(() => router.push("/profile" as any)),
                  ]}
                >
                  <Text
                    style={{ typography: "titleMedium", fontWeight: "bold" }}
                    color={colors.onPrimaryContainer}
                  >
                    {user?.fullname?.[0]?.toUpperCase() ?? "?"}
                  </Text>
                </Box>
              )}
            </Row>
          </Row>

          {/* Tagihan card */}
          <Card
            colors={{ containerColor: colors.primary }}
            modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(24))]}
          >
            <Column
              verticalArrangement={{ spacedBy: 8 }}
              modifiers={[fillMaxWidth(), paddingAll(20)]}
            >
              <Row
                horizontalArrangement="spaceBetween"
                verticalAlignment="center"
                modifiers={[fillMaxWidth()]}
              >
                <Text
                  style={{
                    typography: "labelLarge",
                    fontWeight: "bold",
                    letterSpacing: 0.5,
                  }}
                  color={colors.onPrimary}
                >
                  {`TAGIHAN · ${monthLabel}`}
                </Text>
                {dueInDays !== null && payment && isPayable(payment.status) && (
                  <Row
                    verticalAlignment="center"
                    horizontalArrangement={{ spacedBy: 4 }}
                    modifiers={[
                      clip(Shapes.RoundedCorner(12)),
                      background(withAlpha(colors.onPrimary, "33")),
                      padding(10, 4, 10, 4),
                    ]}
                  >
                    <Text
                      style={{ typography: "labelSmall", fontWeight: "bold" }}
                      color={colors.onPrimary}
                    >
                      {dueInDays <= 0
                        ? "Jatuh tempo"
                        : `${dueInDays} hari lagi`}
                    </Text>
                  </Row>
                )}
              </Row>

              <Text
                style={{ typography: "headlineLarge", fontWeight: "bold" }}
                color={colors.onPrimary}
              >
                {payment?.amount != null
                  ? formatRupiah(payment.amount)
                  : "Belum ada tagihan"}
              </Text>

              {payment?.due_date && (
                <Text
                  style={{ typography: "bodyMedium" }}
                  color={withAlpha(colors.onPrimary, "CC")}
                >
                  {`Jatuh tempo ${parseTs(payment.due_date).toLocaleDateString("id-ID", { day: "2-digit", month: "long" })}`}
                </Text>
              )}

              {payment && isPayable(payment.status) && (
                <Button
                  onClick={() => setPayFormOpen(true)}
                  colors={{
                    containerColor: colors.onPrimary,
                    contentColor: colors.primary,
                  }}
                  modifiers={[fillMaxWidth()]}
                >
                  <Text
                    style={{ typography: "labelLarge", fontWeight: "bold" }}
                    color={colors.primary}
                  >
                    Bayar sekarang
                  </Text>
                </Button>
              )}
            </Column>
          </Card>

          {/* Quick actions */}
          <Row
            horizontalArrangement="spaceBetween"
            modifiers={[fillMaxWidth()]}
          >
            <QuickAction
              icon={ReceiptLong}
              label="Split Bill"
              onClick={() => router.push("/split-bill" as any)}
            />
            <QuickAction
              icon={Event}
              label="Event"
              onClick={() => router.push("/events" as any)}
            />
            <QuickAction
              icon={Forum}
              label="Request"
              onClick={() => router.push("/requests" as any)}
            />
            <QuickAction
              icon={Receipt}
              label="Kwitansi"
              onClick={() => router.push("/receipts" as any)}
            />
          </Row>

          {/* Perlu perhatian */}
          <Column verticalArrangement={{ spacedBy: 12 }}>
            <Row
              verticalAlignment="center"
              horizontalArrangement={{ spacedBy: 8 }}
            >
              <Text
                style={{ typography: "titleMedium", fontWeight: "bold" }}
                color={colors.onBackground}
              >
                Perlu perhatian
              </Text>
              {attentionItems.length > 0 && (
                <Badge containerColor={colors.error}>
                  <Text
                    style={{ typography: "labelSmall" }}
                    color={colors.onError}
                  >
                    {String(attentionItems.length)}
                  </Text>
                </Badge>
              )}
            </Row>
            {attentionItems.length === 0 && (
              <Text
                style={{ typography: "bodyMedium" }}
                color={colors.onSurfaceVariant}
              >
                Semua beres, tidak ada yang perlu perhatian kamu.
              </Text>
            )}
            {attentionItems.map((item) => (
              <AttentionCard key={item.id} item={item} />
            ))}
          </Column>

          {/* Aktivitas terkini */}
          <Column verticalArrangement={{ spacedBy: 8 }}>
            <Row
              horizontalArrangement="spaceBetween"
              verticalAlignment="center"
              modifiers={[fillMaxWidth()]}
            >
              <Text
                style={{ typography: "titleMedium", fontWeight: "bold" }}
                color={colors.onBackground}
              >
                Aktivitas terkini
              </Text>
            </Row>
            {activityItems.length === 0 && (
              <Text
                style={{ typography: "bodyMedium" }}
                color={colors.onSurfaceVariant}
              >
                Belum ada aktivitas.
              </Text>
            )}
            {activityItems.map((item) => (
              <Row
                key={item.id}
                verticalAlignment="center"
                horizontalArrangement={{ spacedBy: 12 }}
              >
                <Box
                  contentAlignment="center"
                  modifiers={[
                    size(36, 36),
                    clip(Shapes.RoundedCorner(18)),
                    background(colors.secondaryContainer),
                  ]}
                >
                  <Icon
                    source={item.icon}
                    tint={colors.onSecondaryContainer}
                    size={18}
                  />
                </Box>
                <Column verticalArrangement={{ spacedBy: 2 }}>
                  <Text
                    style={{ typography: "bodyMedium" }}
                    color={colors.onSurface}
                  >
                    {item.text}{" "}
                    <Text
                      style={{ fontWeight: "700" }}
                      color={colors.onSurface}
                    >
                      {item.highlight}
                    </Text>
                  </Text>
                  <Text
                    style={{ typography: "bodySmall" }}
                    color={colors.onSurfaceVariant}
                  >
                    {timeAgo(item.at)}
                  </Text>
                </Column>
              </Row>
            ))}
          </Column>
        </Column>
      </PullToRefreshBox>

      {payFormOpen && payment && user && (
        <PayFormSheet
          payment={payment}
          userId={user.id}
          userFullname={user.fullname}
          onClose={() => setPayFormOpen(false)}
          onSubmitted={() => {
            loadData();
            setPayFormOpen(false);
          }}
        />
      )}
    </Host>
  );
}

function QuickAction({
  icon,
  label,
  badge,
  onClick,
}: {
  icon: ImageSourcePropType;
  label: string;
  badge?: number;
  onClick: () => void;
}) {
  const colors = useMaterialColors();
  const iconTile = (
    <Box
      contentAlignment="center"
      modifiers={[
        size(56, 56),
        clip(Shapes.RoundedCorner(16)),
        background(colors.primaryContainer),
        clickable(onClick),
      ]}
    >
      <Icon source={icon} tint={colors.onPrimaryContainer} size={24} />
    </Box>
  );

  return (
    <Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 6 }}>
      {badge ? (
        <BadgedBox>
          {iconTile}
          <BadgedBox.Badge>
            <Badge containerColor={colors.error}>
              <Text style={{ typography: "labelSmall" }} color={colors.onError}>
                {String(badge)}
              </Text>
            </Badge>
          </BadgedBox.Badge>
        </BadgedBox>
      ) : (
        iconTile
      )}
      <Text
        style={{ typography: "labelMedium" }}
        color={colors.onSurfaceVariant}
      >
        {label}
      </Text>
    </Column>
  );
}

function AttentionCard({ item }: { item: AttentionItem }) {
  const colors = useMaterialColors();

  return (
    <Card
      colors={{ containerColor: colors.surfaceContainerLow }}
      modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(20))]}
    >
      <Row
        verticalAlignment="center"
        horizontalArrangement={{ spacedBy: 12 }}
        modifiers={[paddingAll(16)]}
      >
        {item.type === "piket" ? (
          <Box
            contentAlignment="center"
            modifiers={[
              size(48, 48),
              clip(Shapes.RoundedCorner(14)),
              background(colors.tertiaryContainer),
            ]}
          >
            <Column horizontalAlignment="center">
              <Text
                style={{ typography: "labelSmall", fontWeight: "bold" }}
                color={colors.onTertiaryContainer}
              >
                {item.dayAbbr}
              </Text>
              <Text
                style={{ typography: "titleMedium", fontWeight: "bold" }}
                color={colors.onTertiaryContainer}
              >
                {String(item.dayNum)}
              </Text>
            </Column>
          </Box>
        ) : (
          <Box
            contentAlignment="center"
            modifiers={[
              size(48, 48),
              clip(Shapes.RoundedCorner(14)),
              background(colors.primaryContainer),
            ]}
          >
            <Icon
              source={Description}
              tint={colors.onPrimaryContainer}
              size={22}
            />
          </Box>
        )}

        <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[weight(1)]}>
          <Text
            style={{ typography: "bodyLarge", fontWeight: "bold" }}
            color={colors.onSurface}
          >
            {item.type === "piket" ? "Giliran piket kamu" : item.title}
          </Text>
          <Text
            style={{ typography: "bodySmall" }}
            color={colors.onSurfaceVariant}
          >
            {item.subtitle}
          </Text>
        </Column>

        {item.type === "piket" ? (
          <OutlinedButton onClick={() => router.push("/(tabs)/piket" as any)}>
            <Text style={{ typography: "labelLarge" }} color={colors.primary}>
              Izin
            </Text>
          </OutlinedButton>
        ) : (
          <Button onClick={() => router.push("/(tabs)/rules" as any)}>
            <Text
              style={{ typography: "labelLarge", fontWeight: "bold" }}
              color={colors.onPrimary}
            >
              Vote
            </Text>
          </Button>
        )}
      </Row>
    </Card>
  );
}
