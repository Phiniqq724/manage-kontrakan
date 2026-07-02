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
  LogRow,
  Rule,
  SectionHeader,
  StatCard,
} from "../../components/UI";
import { Colors, FontSize, Spacing } from "../../constants/theme";
import {
  guestsApi,
  paymentsApi,
  piketsApi,
  rulesApi,
} from "../../services/api";
import { useAuth } from "../../utils/auth-context";
import { sendPushNotification } from "../../utils/notifications";
import type { Database } from "../../utils/supabase-types";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type GuestRow = Database["public"]["Tables"]["guests"]["Row"];
type RuleRow = Database["public"]["Tables"]["rules"]["Row"];

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Lunas",
  pending: "Menunggu",
  rejected: "Ditolak",
};
const STATUS_TYPE: Record<string, "success" | "warning" | "danger" | "muted"> =
  {
    confirmed: "success",
    pending: "warning",
    rejected: "danger",
  };
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

const TODAY = new Date().toLocaleDateString("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default function DashboardScreen() {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [piketDone, setPiketDone] = useState(0);
  const [piketPending, setPiketPending] = useState(0);
  const [piketNext, setPiketNext] = useState("-");
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [rules, setRules] = useState<RuleRow[]>([]);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user?.id]);

  async function loadData() {
    const [piketRes, payRes, guestRes, rulesRes] = await Promise.all([
      piketsApi.getAll(),
      paymentsApi.getByUser(user!.id),
      guestsApi.getAll(),
      rulesApi.getAll(),
    ]);

    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allPikets = piketRes.data ?? [];
    const monthPikets = allPikets.filter((p) => {
      const d = new Date(p.day);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });
    setPiketDone(monthPikets.filter((p) => p.status === "done").length);
    setPiketPending(
      monthPikets.filter((p) => p.assign_to === user!.id && p.status !== "done")
        .length,
    );

    const myNext = allPikets
      .filter(
        (p) =>
          p.assign_to === user!.id &&
          new Date(p.day) >= today &&
          p.status !== "done",
      )
      .sort((a, b) => new Date(a.day).getTime() - new Date(b.day).getTime())[0];
    if (myNext) {
      const diffDays = Math.ceil(
        (new Date(myNext.day).getTime() - today.getTime()) / 86400000,
      );
      setPiketNext(
        diffDays === 0
          ? "Hari ini"
          : diffDays === 1
            ? "Besok"
            : `${diffDays} hari lagi`,
      );
    }

    const recentPayments = (payRes.data ?? [])
      .sort((a, b) => b.period.localeCompare(a.period))
      .slice(0, 3);
    setPayments(recentPayments);

    const recentGuests = (guestRes.data ?? [])
      .sort(
        (a, b) =>
          new Date(b.check_in).getTime() - new Date(a.check_in).getTime(),
      )
      .slice(0, 2);
    setGuests(recentGuests);

    setRules((rulesRes.data ?? []).slice(0, 3));
  }

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Selamat pagi,";
    if (h < 17) return "Selamat siang,";
    return "Selamat malam,";
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Colors.accent}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>{greeting()}</Text>
        <Text style={styles.name}>{user?.fullname?.split(" ")[0] ?? ""}.</Text>
        <Text style={styles.date}>{TODAY.toUpperCase()}</Text>
        <Rule style={{ marginTop: Spacing.md }} />
      </View>

      <SectionHeader label="Piket Bulan Ini" />
      <Rule />
      <View style={styles.statsRow}>
        <StatCard value={String(piketDone)} label="Selesai" sub="BULAN INI" />
        <View style={{ width: Spacing.sm }} />
        <StatCard
          value={String(piketPending)}
          label="Tertunda"
          sub="PERLU PERHATIAN"
        />
        <View style={{ width: Spacing.sm }} />
        <StatCard value={piketNext} label="Giliranmu" sub="BERIKUTNYA" />
      </View>

      <View style={{ marginTop: Spacing.lg }}>
        <SectionHeader label="Rekap Pembayaran" />
        <Rule />
        {payments.length === 0 && (
          <Text style={styles.emptyText}>Belum ada data pembayaran.</Text>
        )}
        {payments.map((p) => (
          <LogRow
            key={p.id}
            date={formatPeriod(p.period)}
            title="Tagihan Bulanan"
            meta={
              p.status === "confirmed" && p.paid_at
                ? `Dibayar: ${new Date(p.paid_at).toLocaleDateString("id-ID")}`
                : p.status === "pending"
                  ? "Menunggu konfirmasi admin"
                  : `Jatuh tempo: ${p.period}`
            }
            badge={STATUS_LABEL[p.status] ?? p.status}
            badgeType={STATUS_TYPE[p.status]}
          />
        ))}
      </View>

      <View style={{ marginTop: Spacing.lg }}>
        <SectionHeader label="Tamu Terkini" />
        <Rule />
        {guests.length === 0 && (
          <Text style={styles.emptyText}>Belum ada tamu terdaftar.</Text>
        )}
        {guests.map((g) => (
          <LogRow
            key={g.id}
            date={new Date(g.check_in).toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "short",
            })}
            title={g.name}
            meta={`Masuk ${new Date(g.check_in).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`}
            badge={g.check_out ? "Selesai" : "Di dalam"}
            badgeType={g.check_out ? "muted" : "warning"}
          />
        ))}
      </View>

      <View style={{ marginTop: Spacing.lg }}>
        <SectionHeader label="Peraturan Terbaru" />
        <Rule />
        {rules.length === 0 && (
          <Text style={styles.emptyText}>Belum ada peraturan.</Text>
        )}
        {rules.map((r, i) => (
          <View key={r.id}>
            <View style={styles.ruleRow}>
              <Badge
                label={PRIORITY_LABEL[r.priority] ?? r.priority}
                type={PRIORITY_TYPE[r.priority] ?? "muted"}
              />
              <Text style={styles.ruleText}>{r.rules}</Text>
            </View>
            {i < rules.length - 1 && <Rule />}
          </View>
        ))}
        <Rule />
      </View>

      {__DEV__ && (
        <View style={{ marginTop: Spacing.lg, paddingHorizontal: Spacing.md }}>
          <TouchableOpacity
            style={styles.devBtn}
            onPress={async () => {
              if (!user?.push_token) {
                alert("[DEV] push_token kosong. Belum terdaftar.");
                return;
              }
              await sendPushNotification(
                user.push_token,
                "Test Notifikasi",
                "Notifikasi berhasil diterima!",
              );
              alert("[DEV] Notifikasi dikirim. Cek HP kamu.");
            }}
          >
            <Text style={styles.devBtnText}>
              🔔 [DEV] KIRIM TEST NOTIFIKASI
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

function formatPeriod(period: string) {
  const d = new Date(period + "-01");
  return d
    .toLocaleDateString("id-ID", { month: "short", year: "numeric" })
    .toUpperCase();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingBottom: Spacing.xl },
  header: { paddingHorizontal: Spacing.md, paddingTop: 60 },
  greeting: { fontSize: FontSize.base, color: Colors.textMuted },
  name: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.xxl,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  date: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.xs,
    color: Colors.textFaint,
    letterSpacing: 1.5,
    marginTop: Spacing.xs,
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  ruleText: { flex: 1, fontSize: FontSize.base, color: Colors.text },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  devBtn: {
    borderWidth: 1,
    borderColor: Colors.accent,
    borderStyle: "dashed",
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  devBtnText: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.xs,
    color: Colors.accent,
    letterSpacing: 1,
  },
});
