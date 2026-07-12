import { useEffect, useState } from "react";
import {
  Image,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import {
  Field,
  GhostButton,
  PageHeader,
  PrimaryButton,
  Rule,
  SectionHeader,
} from "../../components/UI";
import { Colors, FontSize, Radius, Spacing } from "../../constants/theme";
import { kamarApi, reportsApi, usersApi } from "../../services/api";
import { useAuth } from "../../utils/auth-context";
import { getAdminToken, sendPushNotification } from "../../utils/notifications";
import { pickAndUploadImage } from "../../utils/upload";
import type { Database } from "../../utils/supabase-types";

type UserRow = Database["public"]["Tables"]["users"]["Row"];
type KamarRow = Database["public"]["Tables"]["kamar"]["Row"];

function truncateDesc(text: string | null): string {
  if (!text) return "-";
  return text.length <= 45 ? text : text.slice(0, 45) + "...";
}

export default function MembersScreen() {
  const { user: currentUser } = useAuth();
  const [members, setMembers] = useState<UserRow[]>([]);
  const [kamarMap, setKamarMap] = useState<Record<string, KamarRow>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [reportModal, setReportModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<UserRow | null>(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [evidenceUri, setEvidenceUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [usersRes, kamarRes] = await Promise.all([
      usersApi.getAll(),
      kamarApi.getAll(),
    ]);
    if (usersRes.data) setMembers(usersRes.data);
    if (kamarRes.data) {
      const map: Record<string, KamarRow> = {};
      for (const k of kamarRes.data) {
        if (k.user_id) map[k.user_id] = k;
      }
      setKamarMap(map);
    }
  }

  const openReport = (member: UserRow) => {
    setSelectedMember(member);
    setTitle("");
    setDesc("");
    setEvidenceUri(null);
    setReportModal(true);
  };

  const handlePickEvidence = async () => {
    try {
      const url = await pickAndUploadImage("report-evidence", currentUser?.id ?? "anon");
      if (url) setEvidenceUri(url);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSubmitReport = async () => {
    if (!title.trim()) {
      alert("Judul laporan wajib diisi.");
      return;
    }
    if (!currentUser || !selectedMember) return;
    setSubmitting(true);
    try {
      const { error } = await reportsApi.create({
        title,
        description: desc,
        suspect: selectedMember.id,
        created_by: currentUser.id,
        docs: evidenceUri,
      });
      if (error) throw error;
      setReportModal(false);
      const adminToken = await getAdminToken();
      if (adminToken) {
        await sendPushNotification(
          adminToken,
          "Laporan Baru",
          `${currentUser.fullname} melaporkan ${selectedMember.fullname}: ${title}.`,
        );
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const initials = (name: string) =>
    name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

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
        <PageHeader title="PENGHUNI" subtitle="Kontak dan info kamar" topInset={60} />


        <SectionHeader label={`${members.length} Penghuni`} />
        <Rule />

        {members.map((m, i) => (
          <View key={m.id}>
            <View style={styles.memberRow}>
              {m.avatar_url ? (
                <Image source={{ uri: m.avatar_url }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(m.fullname)}</Text>
                </View>
              )}
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{m.fullname}</Text>
                <Text style={styles.memberSub}>{m.username} · {m.role}</Text>
                {kamarMap[m.id] && (
                  <Text style={styles.memberRoom}>
                    {kamarMap[m.id].room_code} · {truncateDesc(kamarMap[m.id].description)}
                  </Text>
                )}
              </View>
              <View style={styles.memberActions}>
                {m.contact && (
                  <>
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() => Linking.openURL(`tel:${m.contact}`)}
                    >
                      <Ionicons name="call-outline" size={18} color={Colors.sage} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() =>
                        Linking.openURL(`https://wa.me/62${m.contact!.slice(1)}`)
                      }
                    >
                      <Ionicons name="logo-whatsapp" size={18} color={Colors.sage} />
                    </TouchableOpacity>
                  </>
                )}
                {currentUser?.id !== m.id && m.role !== "admin" && (
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => openReport(m)}
                  >
                    <Ionicons name="flag-outline" size={18} color={Colors.danger} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {i < members.length - 1 && <Rule />}
          </View>
        ))}
      </ScrollView>

      <Modal visible={reportModal} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>LAPORKAN PENGHUNI</Text>
            <Text style={styles.modalSub}>{selectedMember?.fullname}</Text>
            <Rule style={{ marginVertical: Spacing.md }} />
            <ScrollView>
              <Field
                label="Judul Laporan"
                value={title}
                onChangeText={setTitle}
                placeholder="Singkat dan jelas"
              />
              <Field
                label="Deskripsi"
                value={desc}
                onChangeText={setDesc}
                placeholder="Jelaskan kejadiannya..."
                multiline
                numberOfLines={4}
              />
              <TouchableOpacity style={styles.evidenceBtn} onPress={handlePickEvidence}>
                <Ionicons
                  name={evidenceUri ? "checkmark-circle" : "attach-outline"}
                  size={18}
                  color={evidenceUri ? Colors.sage : Colors.textMuted}
                />
                <Text style={[styles.evidenceBtnText, evidenceUri && { color: Colors.sage }]}>
                  {evidenceUri ? "Bukti terlampir" : "Lampirkan Bukti (Opsional)"}
                </Text>
              </TouchableOpacity>
              <View style={styles.modalActions}>
                <GhostButton label="BATAL" onPress={() => setReportModal(false)} />
                <View style={{ width: Spacing.sm }} />
                <PrimaryButton
                  label={submitting ? "MENGIRIM..." : "KIRIM LAPORAN"}
                  onPress={handleSubmitReport}
                  danger
                />
              </View>
            </ScrollView>
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
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.sm,
    color: Colors.accent,
  },
  avatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  memberInfo: { flex: 1 },
  memberName: { fontSize: FontSize.base, color: Colors.text },
  memberSub: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  memberRoom: { fontSize: FontSize.xs, color: Colors.textFaint, marginTop: 2, fontFamily: "SpaceMono" },
  memberActions: { flexDirection: "row", gap: Spacing.xs },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
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
  },
  evidenceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  evidenceBtnText: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  modalActions: { flexDirection: "row", marginTop: Spacing.sm },
});
