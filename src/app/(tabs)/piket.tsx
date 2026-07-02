import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
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
  PageHeader,
  PrimaryButton,
  Rule,
  SectionHeader,
  StatCard,
} from "../../components/UI";
import { Colors, FontSize, Spacing } from "../../constants/theme";
import { piketRequestsApi, piketsApi, usersApi } from "../../services/api";
import { useAuth } from "../../utils/auth-context";
import { sendPushNotification } from "../../utils/notifications";
import {
  generatePiketRows,
  getTodayStr,
  isEndOfMonth,
} from "../../utils/piket-utils";
import type { Database } from "../../utils/supabase-types";
import { captureAndUploadImage } from "../../utils/upload";

type PiketRow = Database["public"]["Tables"]["pikets"]["Row"];
type PiketRequestRow = Database["public"]["Tables"]["piket_requests"]["Row"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];

const STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu",
  done: "Selesai",
  absent: "Absen",
  izin: "Izin",
};
const STATUS_TYPE: Record<string, "warning" | "success" | "danger" | "muted"> =
  {
    pending: "warning",
    done: "success",
    absent: "danger",
    izin: "muted",
  };

export default function PiketScreen() {
  const { user: currentUser } = useAuth();
  const [pikets, setPikets] = useState<PiketRow[]>([]);
  const [users, setUsers] = useState<Record<string, UserRow>>({});
  const [pendingRequests, setPendingRequests] = useState<PiketRequestRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [assignModal, setAssignModal] = useState(false);
  const [myNextPiket, setMyNextPiket] = useState<PiketRow | null>(null);
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

    // Auto-generate next month's schedule only at end of current month
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const futurePikets = allPikets.filter((p) => new Date(p.day) >= today);
    if (
      futurePikets.length === 0 &&
      isEndOfMonth() &&
      (userRes.data ?? []).length > 0
    ) {
      const nonAdminIds = (userRes.data ?? [])
        .filter((u) => u.role !== "admin")
        .map((u) => u.id);
      if (nonAdminIds.length > 0) {
        const next = new Date();
        next.setMonth(next.getMonth() + 1);
        const rows = generatePiketRows(
          nonAdminIds,
          next.getFullYear(),
          next.getMonth() + 1,
        );
        for (const row of rows) {
          await piketsApi.create(row);
        }
        const refreshed = await piketsApi.getAll();
        if (refreshed.data) {
          allPikets.splice(
            0,
            allPikets.length,
            ...refreshed.data.sort(
              (a, b) => new Date(b.day).getTime() - new Date(a.day).getTime(),
            ),
          );
          setPikets([...allPikets]);
        }
      }
    }

    if (currentUser) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const next =
        allPikets
          .filter(
            (p) =>
              p.assign_to === currentUser.id &&
              new Date(p.day) >= today &&
              p.status !== "done",
          )
          .sort(
            (a, b) => new Date(a.day).getTime() - new Date(b.day).getTime(),
          )[0] ?? null;
      setMyNextPiket(next ?? null);

      const pending = (reqRes.data ?? []).filter(
        (r) => r.assign_to === currentUser.id && r.status === "pending",
      );
      setPendingRequests(pending);
    }
  }

  async function handleSubmitRequest() {
    if (!myNextPiket || !selectedReplacementId) {
      alert("Pilih penghuni pengganti.");
      return;
    }
    // Block assigning to the partner on the same Sunday
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

      // Notify the replacement person
      const replacement = users[selectedReplacementId];
      if (replacement?.push_token) {
        const piketDate = myNextPiket
          ? new Date(myNextPiket.day).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
            })
          : "";
        await sendPushNotification(
          replacement.push_token,
          "Permintaan Tukar Piket",
          `${currentUser?.fullname} meminta kamu menggantikan piket tanggal ${piketDate}.`,
        );
      }

      setAssignModal(false);
      setReason("");
      setSelectedReplacementId(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFinishPiket(piket: PiketRow) {
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

  const thisMonth = new Date().getMonth();
  const thisYear = new Date().getFullYear();
  const monthPikets = pikets.filter((p) => {
    const d = new Date(p.day);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });
  const statDone = monthPikets.filter((p) => p.status === "done").length;
  const statPending = monthPikets.filter(
    (p) => p.assign_to === currentUser?.id && p.status === "pending",
  ).length;
  const statIzin = monthPikets.filter((p) => p.status === "izin").length;

  const otherMembers = Object.values(users).filter(
    (u) => u.id !== currentUser?.id,
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
              await loadData();
              setRefreshing(false);
            }}
            tintColor={Colors.accent}
          />
        }
      >
        <PageHeader title="PIKET" subtitle="Jadwal kebersihan penghuni" />

        <View style={styles.statsRow}>
          <StatCard value={String(statDone)} label="Selesai" sub="BULAN INI" />
          <View style={{ width: Spacing.sm }} />
          <StatCard
            value={String(statPending)}
            label="Tertunda"
            sub="PERLU PERHATIAN"
          />
          <View style={{ width: Spacing.sm }} />
          <StatCard value={String(statIzin)} label="Izin" sub="DIALIHKAN" />
        </View>

        {pendingRequests.length > 0 && (
          <View style={{ marginBottom: Spacing.lg }}>
            <SectionHeader label="Permintaan Masuk" />
            <Rule />
            {pendingRequests.map((req) => {
              const piket = pikets.find((p) => p.id === req.piket_id);
              const requester = piket?.assign_to
                ? users[piket.assign_to]
                : null;
              return (
                <View key={req.id} style={styles.requestCard}>
                  <View style={styles.requestInfo}>
                    <Text style={styles.requestTitle}>
                      {requester?.fullname ?? "Seseorang"} minta tukar piket
                    </Text>
                    <Text style={styles.requestMeta}>
                      {piket
                        ? new Date(piket.day).toLocaleDateString("id-ID", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                          })
                        : ""}
                    </Text>
                    {req.reason && (
                      <Text style={styles.requestReason}>"{req.reason}"</Text>
                    )}
                  </View>
                  <View style={styles.requestBtns}>
                    <TouchableOpacity
                      style={[styles.respondBtn, styles.acceptBtn]}
                      onPress={() => handleRespondRequest(req, true)}
                    >
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={Colors.sage}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.respondBtn, styles.declineBtn]}
                      onPress={() => handleRespondRequest(req, false)}
                    >
                      <Ionicons name="close" size={16} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {myNextPiket && (
          <View style={styles.turnNotice}>
            <View style={styles.turnLeft}>
              <Text style={styles.turnLabel}>GILIRAN KAMU</Text>
              <Text style={styles.turnDate}>
                {new Date(myNextPiket.day).toLocaleDateString("id-ID", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.assignBtn}
              onPress={() => setAssignModal(true)}
            >
              <Text style={styles.assignBtnText}>MINTA IZIN</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ marginTop: Spacing.lg }}>
          <SectionHeader label="Jadwal Piket" />
          <Rule />
          {(() => {
            const todayStr = getTodayStr();
            const groupedMap: Record<string, PiketRow[]> = {};
            pikets.forEach((p) => {
              (groupedMap[p.day] ??= []).push(p);
            });
            return Object.entries(groupedMap)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([day, group]) => {
                const isToday = day === todayStr;
                const myPiketToday = isToday
                  ? group.find(
                      (p) => p.assign_to === currentUser?.id && !p.finished,
                    )
                  : null;
                return (
                  <View key={day}>
                    <View style={styles.piketGroup}>
                      <Text style={styles.piketGroupDate}>
                        {new Date(day).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                        })}
                        {isToday ? " · HARI INI" : ""}
                      </Text>
                      {group.map((p) => {
                        const u = p.assign_to ? users[p.assign_to] : null;
                        return (
                          <View key={p.id} style={styles.piketGroupRow}>
                            <Text style={styles.piketGroupName}>
                              {u?.fullname ?? "-"}{" "}
                              {p.assign_to === currentUser?.id && "(You)"}
                            </Text>
                            <View style={styles.piketGroupRight}>
                              {p.finished && (
                                <Ionicons
                                  name="checkmark-circle"
                                  size={14}
                                  color={Colors.sage}
                                />
                              )}
                              <Badge
                                label={STATUS_LABEL[p.status] ?? p.status}
                                type={
                                  p.assign_to === currentUser?.id
                                    ? "warning"
                                    : (STATUS_TYPE[p.status] ?? "muted")
                                }
                              />
                            </View>
                          </View>
                        );
                      })}
                      {myPiketToday && (
                        <TouchableOpacity
                          style={styles.finishBtn}
                          onPress={() => handleFinishPiket(myPiketToday)}
                        >
                          <Ionicons
                            name="camera-outline"
                            size={14}
                            color={Colors.bg}
                          />
                          <Text style={styles.finishBtnText}>
                            SELESAIKAN PIKET
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <Rule />
                  </View>
                );
              });
          })()}
        </View>
      </ScrollView>

      <Modal visible={assignModal} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>MINTA IZIN PIKET</Text>
              {myNextPiket && (
                <Text style={styles.modalSub}>
                  {new Date(myNextPiket.day).toLocaleDateString("id-ID", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </Text>
              )}
              <Rule style={{ marginVertical: Spacing.md }} />
              <ScrollView>
                <Field
                  label="Alasan"
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Kenapa kamu tidak bisa piket?"
                  multiline
                />
                <Text style={styles.pickLabel}>GANTI KE</Text>
                <Rule />
                {otherMembers.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={[
                      styles.memberOption,
                      selectedReplacementId === m.id &&
                        styles.memberOptionSelected,
                    ]}
                    onPress={() => setSelectedReplacementId(m.id)}
                  >
                    <Text
                      style={[
                        styles.memberOptionText,
                        selectedReplacementId === m.id &&
                          styles.memberOptionTextSelected,
                      ]}
                    >
                      {m.fullname}
                    </Text>
                    {selectedReplacementId === m.id && (
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={Colors.accent}
                      />
                    )}
                  </TouchableOpacity>
                ))}
                <Rule />
                <View style={styles.modalActions}>
                  <GhostButton
                    label="BATAL"
                    onPress={() => setAssignModal(false)}
                  />
                  <View style={{ width: Spacing.sm }} />
                  <PrimaryButton
                    label={submitting ? "MENGAJUKAN..." : "AJUKAN"}
                    onPress={handleSubmitRequest}
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
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  requestCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: Spacing.md,
  },
  requestInfo: { flex: 1 },
  requestTitle: { fontSize: FontSize.base, color: Colors.text },
  requestMeta: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  requestReason: {
    fontSize: FontSize.sm,
    color: Colors.textFaint,
    fontStyle: "italic",
    marginTop: 2,
  },
  requestBtns: { flexDirection: "row", gap: Spacing.xs },
  respondBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  acceptBtn: { borderColor: Colors.sage },
  declineBtn: { borderColor: Colors.danger },
  turnNotice: {
    marginHorizontal: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
    padding: Spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.surface,
  },
  turnLeft: { gap: 4 },
  turnLabel: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.xs,
    color: Colors.accent,
    letterSpacing: 1.5,
  },
  turnDate: { fontSize: FontSize.base, color: Colors.text },
  assignBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.text,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  assignBtnText: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.xs,
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
  pickLabel: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: Spacing.xs,
  },
  memberOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  memberOptionSelected: { backgroundColor: Colors.surface },
  memberOptionText: { fontSize: FontSize.base, color: Colors.text },
  memberOptionTextSelected: { color: Colors.accent, fontFamily: "SpaceMono" },
  modalActions: { flexDirection: "row", marginTop: Spacing.sm },
  piketGroup: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  piketGroupDate: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: 2,
  },
  piketGroupRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  piketGroupName: { fontSize: FontSize.base, color: Colors.text },
  piketGroupRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  finishBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignSelf: "flex-start",
    marginTop: Spacing.xs,
  },
  finishBtnText: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.xs,
    color: Colors.bg,
    letterSpacing: 1,
  },
});
