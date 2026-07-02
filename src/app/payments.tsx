import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
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
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import {
  Badge,
  GhostButton,
  PageHeader,
  PrimaryButton,
  Rule,
  SectionHeader,
} from "../components/UI";
import { Colors, FontSize, Spacing } from "../constants/theme";
import { paymentsApi } from "../services/api";
import { useAuth } from "../utils/auth-context";
import { getAdminToken, sendPushNotification } from "../utils/notifications";
import type { Database } from "../utils/supabase-types";
import { pickAndUploadImage } from "../utils/upload";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

const STATUS_LABEL: Record<string, string> = {
  on_time: "Tepat Waktu",
  late: "Terlambat",
  pending: "Menunggu",
  rejected: "Ditolak",
  waiting_payment: "Belum Dibayar",
};
const STATUS_TYPE: Record<string, "success" | "warning" | "danger" | "muted"> =
  {
    on_time: "success",
    late: "warning",
    pending: "warning",
    rejected: "danger",
    waiting_payment: "danger",
  };

function formatPeriod(period: string) {
  const d = new Date(period + "-01");
  return d
    .toLocaleDateString("id-ID", { month: "long", year: "numeric" })
    .toUpperCase();
}

export default function PaymentsScreen() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<PaymentRow | null>(null);
  const [payModal, setPayModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRow | null>(null);
  const [docsUrl, setDocsUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user?.id) loadPayments();
  }, [user?.id]);

  async function loadPayments() {
    if (!user?.id) return;
    const { data } = await paymentsApi.getByUser(user.id);
    if (data)
      setPayments(data.sort((a, b) => b.period.localeCompare(a.period)));
  }

  const openPayModal = (payment: PaymentRow) => {
    setSelectedPayment(payment);
    setDocsUrl(null);
    setPayModal(true);
  };

  const handlePickProof = async () => {
    setUploading(true);
    try {
      const url = await pickAndUploadImage("payment-proofs", user?.id ?? "anon");
      if (url) setDocsUrl(url);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitPayment = async () => {
    if (!docsUrl || !selectedPayment) {
      alert("Lampirkan bukti transfer terlebih dahulu.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await paymentsApi.update(selectedPayment.id, {
        status: "pending",
        docs: docsUrl,
        paid_at: new Date().toISOString(),
      });
      if (error) throw error;
      setPayModal(false);
      loadPayments();
      const adminToken = await getAdminToken();
      if (adminToken) {
        await sendPushNotification(
          adminToken,
          "Bukti Pembayaran Baru",
          `${user!.fullname} mengirimkan bukti pembayaran ${formatPeriod(selectedPayment.period)}.`,
        );
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const actionablePayment = payments.find(
    (p) => p.status === "waiting_payment" || p.status === "rejected",
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await loadPayments();
              setRefreshing(false);
            }}
            tintColor={Colors.accent}
          />
        }
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <PageHeader title="TAGIHAN" subtitle="Riwayat dan pembayaran sewa" />
        </View>

        {actionablePayment && (
          <TouchableOpacity
            style={styles.unpaidBanner}
            onPress={() => openPayModal(actionablePayment)}
            activeOpacity={0.7}
          >
            <View>
              <Text style={styles.unpaidLabel}>
                {actionablePayment.status === "rejected" ? "BUKTI DITOLAK" : "TAGIHAN BELUM DIBAYAR"}
              </Text>
              <Text style={styles.unpaidPeriod}>
                {formatPeriod(actionablePayment.period)}
              </Text>
            </View>
            <PrimaryButton
              label={actionablePayment.status === "rejected" ? "UPLOAD ULANG" : "BAYAR"}
              onPress={() => openPayModal(actionablePayment)}
            />
          </TouchableOpacity>
        )}

        <View style={{ marginTop: Spacing.lg }}>
          <SectionHeader
            label={`${payments.length} Riwayat Pembayaran`}
          />
          <Rule />
          {payments.length === 0 && (
            <Text style={styles.emptyText}>Belum ada riwayat pembayaran.</Text>
          )}
          {payments.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.payRow}
              onPress={() => setSelected(p)}
              activeOpacity={0.6}
            >
              <View style={styles.payInfo}>
                <Text style={styles.payPeriod}>{formatPeriod(p.period)}</Text>
                <Text style={styles.payMeta}>
                  {(p.status === "on_time" || p.status === "late") && p.paid_at
                    ? `Dikonfirmasi · ${new Date(p.paid_at).toLocaleDateString("id-ID")}`
                    : p.status === "pending"
                      ? "Menunggu konfirmasi admin"
                      : p.status === "rejected"
                        ? "Bukti ditolak, perlu upload ulang"
                        : "Tagihan belum dibayar"}
                </Text>
              </View>
              <Badge
                label={STATUS_LABEL[p.status] ?? p.status}
                type={STATUS_TYPE[p.status]}
              />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Payment detail modal */}
      <Modal visible={!!selected} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            {selected && (
              <>
                <Text style={styles.modalTitle}>DETAIL PEMBAYARAN</Text>
                <Text style={styles.modalSub}>
                  {formatPeriod(selected.period)}
                </Text>
                <Badge
                  label={STATUS_LABEL[selected.status] ?? selected.status}
                  type={STATUS_TYPE[selected.status]}
                />
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
                  <GhostButton
                    label="TUTUP"
                    onPress={() => setSelected(null)}
                  />
                  {(selected.status === "waiting_payment" || selected.status === "rejected") && (
                    <>
                      <View style={{ width: Spacing.sm }} />
                      <PrimaryButton
                        label={selected.status === "rejected" ? "UPLOAD ULANG" : "BAYAR"}
                        onPress={() => {
                          setSelected(null);
                          openPayModal(selected);
                        }}
                      />
                    </>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* New payment modal */}
      <Modal visible={payModal} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>INPUT PEMBAYARAN</Text>
              <Text style={styles.modalSub}>
                {selectedPayment ? formatPeriod(selectedPayment.period) : ""}
              </Text>
              <Rule style={{ marginVertical: Spacing.md }} />
              <TouchableOpacity
                style={styles.uploadBtn}
                onPress={handlePickProof}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={docsUrl ? "checkmark-circle" : "cloud-upload-outline"}
                  size={20}
                  color={docsUrl ? Colors.sage : Colors.textMuted}
                />
                <Text
                  style={[
                    styles.uploadBtnText,
                    docsUrl && { color: Colors.sage },
                  ]}
                >
                  {uploading
                    ? "Mengunggah..."
                    : docsUrl
                      ? "Bukti terunggah"
                      : "UNGGAH BUKTI TRANSFER"}
                </Text>
              </TouchableOpacity>
              <Text style={styles.uploadNote}>
                Bukti akan diverifikasi oleh admin dalam 1×24 jam.
              </Text>
              <View style={styles.modalActions}>
                <GhostButton label="BATAL" onPress={() => setPayModal(false)} />
                <View style={{ width: Spacing.sm }} />
                <PrimaryButton
                  label={submitting ? "MENGIRIM..." : "KIRIM BUKTI"}
                  onPress={handleSubmitPayment}
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingBottom: Spacing.xl },
  headerRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  backBtn: { paddingLeft: Spacing.md, paddingTop: Spacing.lg },
  unpaidBanner: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.danger,
    padding: Spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  unpaidLabel: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.xs,
    color: Colors.danger,
    letterSpacing: 1,
  },
  unpaidPeriod: { fontSize: FontSize.base, color: Colors.text, marginTop: 4 },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  payRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  payInfo: { flex: 1 },
  payPeriod: { fontSize: FontSize.base, color: Colors.text },
  payMeta: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
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
  modalSub: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 4,
    marginBottom: Spacing.xs,
  },
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
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  uploadBtnText: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  uploadNote: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.lg,
  },
  modalActions: { flexDirection: "row" },
});
