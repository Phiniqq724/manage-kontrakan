import { useEffect, useState } from "react";
import {
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Badge,
  GhostButton,
  PageHeader,
  PrimaryButton,
  Rule,
  SectionHeader,
} from "../../components/UI";
import { Colors, FontSize, Spacing } from "../../constants/theme";
import { paymentsApi, usersApi } from "../../services/api";
import { sendPushNotification } from "../../utils/notifications";
import type { Database } from "../../utils/supabase-types";

const BILL_AMOUNT = 123000;
const DUE_DAY = 10; // 10th of each month

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];

function formatPeriod(period: string) {
  const d = new Date(period + "-01");
  return d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

export default function AdminPaymentsScreen() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [users, setUsers] = useState<Record<string, UserRow>>({});
  const [selected, setSelected] = useState<PaymentRow | null>(null);
  const [processing, setProcessing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [payRes, userRes] = await Promise.all([
      paymentsApi.getAll(),
      usersApi.getAll(),
    ]);
    const userMap: Record<string, UserRow> = {};
    (userRes.data ?? []).forEach((u) => { userMap[u.id] = u; });
    setUsers(userMap);
    const sorted = (payRes.data ?? []).sort((a, b) =>
      a.status === "pending" ? -1 : b.status === "pending" ? 1 : b.period.localeCompare(a.period),
    );
    setPayments(sorted);
  }

  async function handleConfirm(action: "approve" | "reject") {
    if (!selected) return;
    setProcessing(true);
    try {
      let finalStatus = action === "reject" ? "rejected" : "on_time";
      if (action === "approve" && selected.paid_at && selected.due_date) {
        const paidDate = new Date(selected.paid_at);
        const dueDate = new Date(selected.due_date);
        finalStatus = paidDate <= dueDate ? "on_time" : "late";
      }

      const { error } = await paymentsApi.update(selected.id, { status: finalStatus });
      if (error) throw error;

      const payer = selected.paid_by ? users[selected.paid_by] : null;
      if (payer?.push_token) {
        const period = new Date(selected.period + "-01").toLocaleDateString("id-ID", { month: "long", year: "numeric" });
        await sendPushNotification(
          payer.push_token,
          action === "approve" ? "Pembayaran Dikonfirmasi" : "Pembayaran Ditolak",
          action === "approve"
            ? finalStatus === "on_time"
              ? `Pembayaran ${period} kamu dikonfirmasi. Tepat waktu!`
              : `Pembayaran ${period} kamu dikonfirmasi. Namun tercatat terlambat.`
            : `Pembayaran ${period} kamu ditolak. Silakan upload ulang bukti transfer.`,
        );
      }

      setSelected(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleGenerateBills() {
    try {
      const now = new Date();
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const dueDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(DUE_DAY).padStart(2, "0")}`;
      const nonAdminUsers = Object.values(users).filter((u) => u.role !== "admin");
      const existing = await paymentsApi.getAll();
      const existingPeriods = new Set(
        (existing.data ?? []).filter((p) => p.period === period).map((p) => p.paid_by),
      );

      let created = 0;
      for (const u of nonAdminUsers) {
        if (!existingPeriods.has(u.id)) {
          const { error: createError } = await paymentsApi.create({
            paid_by: u.id,
            period,
            due_date: dueDate,
            amount: BILL_AMOUNT,
            status: "waiting_payment",
          });
          if (createError) throw createError;
          if (u.push_token) {
            await sendPushNotification(
              u.push_token,
              "Tagihan Bulan Ini Tersedia",
              `Tagihan sewa ${new Date(period + "-01").toLocaleDateString("id-ID", { month: "long", year: "numeric" })} sebesar Rp ${BILL_AMOUNT.toLocaleString("id-ID")} sudah tersedia.`,
            );
          }
          created++;
        }
      }
      alert(`${created} tagihan berhasil dibuat untuk periode ${period}.`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  const STATUS_LABEL: Record<string, string> = {
    on_time: "Tepat Waktu",
    late: "Terlambat",
    pending: "Menunggu",
    rejected: "Ditolak",
    waiting_payment: "Belum Dibayar",
  };
  const STATUS_TYPE: Record<string, "success" | "warning" | "danger"> = {
    on_time: "success",
    late: "warning",
    pending: "warning",
    rejected: "danger",
    waiting_payment: "danger",
  };

  return (
    <View style={styles.container}>
      <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }}
              tintColor={Colors.accent}
            />
          }
        >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <PageHeader title="PEMBAYARAN" subtitle="Konfirmasi bukti transfer" />
        </View>

        <View style={{ paddingHorizontal: Spacing.md, marginBottom: Spacing.md }}>
          <PrimaryButton label="BUAT TAGIHAN BULAN INI" onPress={handleGenerateBills} />
        </View>
        <SectionHeader label={`${payments.filter((p) => p.status === "pending").length} Menunggu`} />
        <Rule />

        {payments.map((p) => {
          const payer = p.paid_by ? users[p.paid_by] : null;
          return (
            <TouchableOpacity
              key={p.id}
              style={styles.payRow}
              onPress={() => setSelected(p)}
              activeOpacity={0.6}
            >
              <View style={styles.payInfo}>
                <Text style={styles.payName}>{payer?.fullname ?? "Unknown"}</Text>
                <Text style={styles.payPeriod}>{formatPeriod(p.period)}</Text>
                {p.paid_at && (
                  <Text style={styles.payDate}>
                    {new Date(p.paid_at).toLocaleDateString("id-ID")}
                  </Text>
                )}
              </View>
              <Badge label={STATUS_LABEL[p.status] ?? p.status} type={STATUS_TYPE[p.status]} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Modal visible={!!selected} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            {selected && (
              <>
                <Text style={styles.modalTitle}>KONFIRMASI PEMBAYARAN</Text>
                <Text style={styles.modalSub}>
                  {users[selected.paid_by ?? ""]?.fullname} · {formatPeriod(selected.period)}
                </Text>
                <Rule style={{ marginVertical: Spacing.md }} />
                {selected.docs ? (
                  <Image
                    source={{ uri: selected.docs }}
                    style={styles.proofImage}
                    resizeMode="contain"
                  />
                ) : (
                  <Text style={styles.noProof}>Tidak ada bukti terlampir.</Text>
                )}
                <View style={styles.modalActions}>
                  <GhostButton label="TOLAK" onPress={() => handleConfirm("reject")} />
                  <View style={{ width: Spacing.sm }} />
                  <PrimaryButton
                    label={processing ? "MEMPROSES..." : "KONFIRMASI"}
                    onPress={() => handleConfirm("approve")}
                  />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingBottom: Spacing.xl },
  headerRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  backBtn: { paddingLeft: Spacing.md, paddingTop: Spacing.lg },
  payRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  payInfo: { flex: 1 },
  payName: { fontSize: FontSize.base, color: Colors.text },
  payPeriod: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  payDate: { fontSize: FontSize.xs, color: Colors.textFaint, marginTop: 1 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(28,28,30,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: Colors.bg,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 40,
    maxHeight: "85%",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.lg,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  modalSub: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 4 },
  proofImage: {
    width: "100%",
    height: 240,
    backgroundColor: Colors.surface,
    marginVertical: Spacing.md,
  },
  noProof: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: "center",
    marginVertical: Spacing.lg,
  },
  modalActions: { flexDirection: "row", marginTop: Spacing.sm },
});
