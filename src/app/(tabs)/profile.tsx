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
  Field,
  GhostButton,
  LogRow,
  PrimaryButton,
  Rule,
  SectionHeader,
} from "../../components/UI";
import { Colors, FontSize, Spacing } from "../../constants/theme";
import { kamarApi, paymentsApi } from "../../services/api";
import { signOut } from "../../utils/auth";
import { useAuth } from "../../utils/auth-context";
import { getAdminToken, sendPushNotification } from "../../utils/notifications";
import type { Database } from "../../utils/supabase-types";
import { pickAndUploadImage } from "../../utils/upload";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type KamarRow = Database["public"]["Tables"]["kamar"]["Row"];

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
    .toLocaleDateString("id-ID", { month: "short", year: "numeric" })
    .toUpperCase();
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [kamar, setKamar] = useState<KamarRow | null>(null);
  const [roomDesc, setRoomDesc] = useState("");
  const [savingDesc, setSavingDesc] = useState(false);
  const [descModal, setDescModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRow | null>(
    null,
  );
  const [uploading, setUploading] = useState(false);
  const [docsUrl, setDocsUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user?.id) loadData();
  }, [user?.id]);

  async function loadData() {
    const [payRes, kamarRes] = await Promise.all([
      paymentsApi.getByUser(user!.id),
      kamarApi.getByUser(user!.id),
    ]);
    if (payRes.data)
      setPayments(payRes.data.sort((a, b) => b.period.localeCompare(a.period)));
    if (kamarRes.data) {
      setKamar(kamarRes.data);
      setRoomDesc(kamarRes.data.description ?? "");
    }
  }

  async function handleSaveRoomDesc() {
    if (!kamar) return;
    setSavingDesc(true);
    try {
      const { error } = await kamarApi.updateDescription(kamar.id, roomDesc);
      if (error) throw error;
      setKamar((prev) => (prev ? { ...prev, description: roomDesc } : prev));
      setDescModal(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingDesc(false);
    }
  }

  async function loadPayments() {
    const { data } = await paymentsApi.getByUser(user!.id);
    if (data)
      setPayments(data.sort((a, b) => b.period.localeCompare(a.period)));
  }

  const actionablePayment = payments.find(
    (p) => p.status === "waiting_payment" || p.status === "rejected",
  );

  const openPayModal = (payment: PaymentRow) => {
    setSelectedPayment(payment);
    setDocsUrl(null);
    setPayModal(true);
  };

  const handlePickProof = async () => {
    setUploading(true);
    try {
      const url = await pickAndUploadImage(
        "payment-proofs",
        user?.id ?? "anon",
      );
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

  const handleLogout = async () => {
    await signOut();
    router.replace("/auth/login");
  };

  const initials = (name: string) =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  if (!user) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await loadData();
              setRefreshing(false);
            }}
            tintColor={Colors.accent}
          />
        }
      >
        <View style={styles.profileHeader}>
          {user.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={styles.avatarLargeImg} />
          ) : (
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarText}>{initials(user.fullname)}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{user.fullname}</Text>
            <Text style={styles.profileRole}>
              {user.role} · {user.username}
            </Text>
            <Text style={styles.profileEmail}>{user.email}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/edit-profile" as any)}
            style={styles.editBtn}
          >
            <Ionicons name="pencil-outline" size={16} color={Colors.accent} />
          </TouchableOpacity>
        </View>
        <Rule />

        {actionablePayment && (
          <TouchableOpacity
            style={styles.unpaidBanner}
            onPress={() => openPayModal(actionablePayment)}
            activeOpacity={0.7}
          >
            <View>
              <Text style={styles.unpaidLabel}>
                {actionablePayment.status === "rejected"
                  ? "BUKTI DITOLAK"
                  : "TAGIHAN BELUM DIBAYAR"}
              </Text>
              <Text style={styles.unpaidPeriod}>
                {formatPeriod(actionablePayment.period)}
              </Text>
            </View>
            <PrimaryButton
              label={
                actionablePayment.status === "rejected"
                  ? "UPLOAD ULANG"
                  : "BAYAR"
              }
              onPress={() => openPayModal(actionablePayment)}
            />
          </TouchableOpacity>
        )}

        <View style={{ marginTop: Spacing.lg }}>
          <SectionHeader
            label="Tagihan"
            action="LIHAT DETAIL"
            onAction={() => router.push("/payments" as any)}
          />
          <Rule />
          {actionablePayment ? (
            <LogRow
              date={formatPeriod(actionablePayment.period)}
              title="Tagihan Bulanan"
              meta={
                actionablePayment.status === "rejected"
                  ? "Bukti ditolak, perlu upload ulang"
                  : "Tagihan belum dibayar"
              }
              badge={
                STATUS_LABEL[actionablePayment.status] ??
                actionablePayment.status
              }
              badgeType={STATUS_TYPE[actionablePayment.status]}
              onPress={() => router.push("/payments" as any)}
            />
          ) : (
            <LogRow
              date="SEMUA LUNAS"
              title="Tidak ada tagihan"
              meta="Semua pembayaran telah dikonfirmasi"
              badge="Lunas"
              badgeType="success"
            />
          )}
          <Rule />
        </View>

        <View style={{ marginTop: Spacing.lg }}>
          <SectionHeader label="Informasi Akun" />
          <Rule />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>USERNAME</Text>
            <Text style={styles.infoValue}>{user.username}</Text>
          </View>
          <Rule />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>KONTAK</Text>
            <Text style={styles.infoValue}>{user.contact ?? "-"}</Text>
          </View>
          <Rule />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>ROLE</Text>
            <Badge
              label={user.role}
              type={user.role === "admin" ? "warning" : "muted"}
            />
          </View>
          <Rule />
        </View>

        {kamar && (
          <View style={{ marginTop: Spacing.lg }}>
            <SectionHeader label="Kamar Saya" />
            <Rule />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>NOMOR KAMAR</Text>
              <Text style={styles.infoValue}>{kamar.room_code}</Text>
            </View>
            <Rule />
            <TouchableOpacity
              style={styles.infoRow}
              onPress={() => {
                setRoomDesc(kamar.description ?? "");
                setDescModal(true);
              }}
              activeOpacity={0.6}
            >
              <Text style={styles.infoLabel}>DESKRIPSI</Text>
              <Text style={[styles.infoValue, { flex: 1, textAlign: "right" }]} numberOfLines={1}>
                {kamar.description ?? "Tambahkan catatan..."}
              </Text>
              <Ionicons name="pencil-outline" size={14} color={Colors.textMuted} style={{ marginLeft: Spacing.sm }} />
            </TouchableOpacity>
            <Rule />
          </View>
        )}

        {user.role === "admin" && (
          <View
            style={{ marginTop: Spacing.lg, paddingHorizontal: Spacing.md }}
          >
            <TouchableOpacity
              style={styles.adminBtn}
              onPress={() => router.push("/admin" as any)}
              activeOpacity={0.7}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={18}
                color={Colors.text}
              />
              <Text style={styles.adminBtnText}>ADMIN PANEL</Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={Colors.textMuted}
              />
            </TouchableOpacity>
          </View>
        )}

        <View style={{ marginTop: Spacing.lg, paddingHorizontal: Spacing.md }}>
          <GhostButton label="KELUAR" onPress={handleLogout} />
        </View>
      </ScrollView>

      <Modal visible={payModal} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>INPUT PEMBAYARAN</Text>
              <Text style={styles.modalSub}>
                Tagihan{" "}
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
              <Text style={styles.modalNote}>
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

      <Modal visible={descModal} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>DESKRIPSI KAMAR</Text>
              <Text style={styles.modalSub}>{kamar?.room_code}</Text>
              <Rule style={{ marginVertical: Spacing.md }} />
              <Field
                label="Deskripsi"
                value={roomDesc}
                onChangeText={setRoomDesc}
                placeholder="Tambahkan catatan kamarmu..."
                multiline
                numberOfLines={3}
              />
              <View style={styles.modalActions}>
                <GhostButton label="BATAL" onPress={() => setDescModal(false)} />
                <View style={{ width: Spacing.sm }} />
                <PrimaryButton
                  label={savingDesc ? "MENYIMPAN..." : "SIMPAN"}
                  onPress={handleSaveRoomDesc}
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
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingTop: 60,
    paddingBottom: Spacing.lg,
  },
  avatarLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLargeImg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
  },
  editBtn: {
    padding: Spacing.sm,
  },
  avatarText: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.md,
    color: Colors.accent,
  },
  profileName: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.lg,
    color: Colors.text,
  },
  profileRole: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  profileEmail: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.xs,
    color: Colors.textFaint,
    marginTop: 2,
  },
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
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  infoLabel: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  infoValue: { fontSize: FontSize.base, color: Colors.text },
  adminBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  adminBtnText: {
    flex: 1,
    fontFamily: "SpaceMono",
    fontSize: FontSize.sm,
    color: Colors.text,
    letterSpacing: 1,
  },
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
  modalNote: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.lg,
  },
  modalActions: { flexDirection: "row" },
});
