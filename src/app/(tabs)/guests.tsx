import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import {
  Field,
  GhostButton,
  LogRow,
  PageHeader,
  PrimaryButton,
  Rule,
  SectionHeader,
  StatCard,
} from "../../components/UI";
import { Colors, FontSize, Spacing } from "../../constants/theme";
import { guestsApi } from "../../services/api";
import type { Database } from "../../utils/supabase-types";
import { useAuth } from "../../utils/auth-context";
import { getAdminToken, sendPushNotification } from "../../utils/notifications";

type GuestRow = Database["public"]["Tables"]["guests"]["Row"];

export default function GuestsScreen() {
  const { user } = useAuth();
  const [addModal, setAddModal] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [activity, setActivity] = useState("");
  const [checkIn, setCheckIn] = useState<Date>(new Date());
  const [checkOut, setCheckOut] = useState<Date | undefined>(undefined);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showCheckOut, setShowCheckOut] = useState(false);

  const openDateTimePicker = (current: Date, onSelect: (d: Date) => void, show: (v: boolean) => void) => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: current,
        mode: "date",
        is24Hour: true,
        onChange: (e, date) => {
          if (e.type === "dismissed" || !date) return;
          DateTimePickerAndroid.open({
            value: date,
            mode: "time",
            is24Hour: true,
            onChange: (e2, finalDate) => {
              if (e2.type === "dismissed" || !finalDate) return;
              onSelect(finalDate);
            },
          });
        },
      });
    } else {
      show(true);
    }
  };
  const [rawGuests, setRawGuests] = useState<GuestRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [checkoutTarget, setCheckoutTarget] = useState<GuestRow | null>(null);
  const [statInside, setStatInside] = useState(0);
  const [statToday, setStatToday] = useState(0);
  const [statMonth, setStatMonth] = useState(0);

  useEffect(() => {
    loadGuests();
  }, []);

  async function loadGuests() {
    const { data, error } = await guestsApi.getAll();
    if (error) {
      console.error(error);
      return;
    }
    if (!data) return;

    const today = new Date().toDateString();
    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();

    setStatInside(data.filter((g) => !g.check_out).length);
    setStatToday(
      data.filter((g) => new Date(g.check_in).toDateString() === today).length,
    );
    setStatMonth(
      data.filter((g) => {
        const d = new Date(g.check_in);
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
      }).length,
    );

    setRawGuests(data);
  }

  async function handleAddGuest() {
    if (checkOut && checkOut <= checkIn) {
      alert("Waktu keluar harus setelah waktu masuk.");
      return;
    }
    try {
      const { data: newGuest, error } = await guestsApi.create({
        name,
        phone,
        activity,
        check_in: checkIn.toISOString(),
        check_out: checkOut ? checkOut.toISOString() : null,
        invited_by: user?.id ?? null,
      });

      if (error) throw error;
      if (newGuest) {
        setRawGuests((prev) => [newGuest, ...prev]);
        setStatInside((n) => (newGuest.check_out ? n : n + 1));
        setStatToday((n) => n + 1);
        setStatMonth((n) => n + 1);
        setAddModal(false);
        setName("");
        setPhone("");
        setActivity("");
        setCheckIn(new Date());
        setCheckOut(undefined);
        const adminToken = await getAdminToken();
        if (adminToken) {
          await sendPushNotification(
            adminToken,
            "Tamu Baru Didaftarkan",
            `${user?.fullname} mendaftarkan tamu baru: ${name}.`,
          );
        }
      }
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleCheckOut(id: string) {
    try {
      const { error } = await guestsApi.update(id, { check_out: new Date().toISOString() });
      if (error) throw error;
      setRawGuests((prev) =>
        prev.map((g) => (g.id === id ? { ...g, check_out: new Date().toISOString() } : g)),
      );
      setStatInside((n) => Math.max(0, n - 1));
    } catch (err: any) {
      alert(err.message);
    }
  }

  const formatDateTime = (d?: Date) => {
    if (!d) return "";
    const day = d.getDate().toString().padStart(2, "0");
    const month = d.toLocaleString("id-ID", { month: "short" });
    const hh = d.getHours().toString().padStart(2, "0");
    const mm = d.getMinutes().toString().padStart(2, "0");
    return `${day} ${month} · ${hh}:${mm}`;
  };

  return (
    <View style={styles.container}>
      <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => { setRefreshing(true); await loadGuests(); setRefreshing(false); }}
              tintColor={Colors.accent}
            />
          }
        >
        <PageHeader title="TAMU" subtitle="Monitoring kunjungan" />

        <View style={styles.statsRow}>
          <StatCard value={String(statInside)} label="Di dalam" sub="SAAT INI" />
          <View style={{ width: Spacing.sm }} />
          <StatCard value={String(statToday)} label="Hari ini" sub="TOTAL KUNJUNGAN" />
          <View style={{ width: Spacing.sm }} />
          <StatCard value={String(statMonth)} label="Bulan ini" sub="TOTAL" />
        </View>

        <View style={{ paddingHorizontal: Spacing.md, marginBottom: Spacing.lg }}>
          <PrimaryButton label="DAFTARKAN TAMU" onPress={() => setAddModal(true)} />
        </View>

        <SectionHeader label="Log Kunjungan" />
        <Rule />
        {rawGuests.map((g) => {
          const parseTs = (s: string) => new Date(s.endsWith("Z") ? s : s + "Z");
          const checkInTime = parseTs(g.check_in).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
          const checkOutTime = g.check_out
            ? parseTs(g.check_out).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
            : null;
          const canCheckOut = !g.check_out && g.invited_by === user?.id;
          return (
            <LogRow
              key={g.id}
              date={parseTs(g.check_in).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
              title={g.name}
              meta={`Diundang · ${checkInTime} — ${checkOutTime ?? "masih di dalam"}`}
              badge={g.check_out ? "Selesai" : "Di dalam"}
              badgeType={g.check_out ? "muted" : "warning"}
              onPress={canCheckOut ? () => setCheckoutTarget(g) : undefined}
            />
          );
        })}
      </ScrollView>

      {/* Checkout confirmation modal */}
      <Modal visible={!!checkoutTarget} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>CHECKOUT TAMU</Text>
            <Text style={styles.modalSub}>
              Checkout <Text style={{ color: Colors.text }}>{checkoutTarget?.name}</Text> sekarang?
            </Text>
            <View style={styles.modalActions}>
              <GhostButton label="BATAL" onPress={() => setCheckoutTarget(null)} />
              <View style={{ width: Spacing.sm }} />
              <PrimaryButton
                label="KONFIRMASI"
                onPress={async () => {
                  if (!checkoutTarget) return;
                  await handleCheckOut(checkoutTarget.id);
                  setCheckoutTarget(null);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={addModal} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>DAFTARKAN TAMU</Text>
            <Rule style={{ marginVertical: Spacing.md }} />
            <ScrollView>
              <Field label="Nama Tamu" value={name} onChangeText={setName} placeholder="Nama lengkap" />
              <Field
                label="No. HP"
                value={phone}
                onChangeText={setPhone}
                placeholder="08xx-xxxx-xxxx"
                keyboardType="phone-pad"
              />
              <Field
                label="Kegiatan"
                value={activity}
                onChangeText={setActivity}
                placeholder="Kunjungan, belajar, dll."
              />

              <TouchableOpacity onPress={() => openDateTimePicker(checkIn, setCheckIn, setShowCheckIn)}>
                <View pointerEvents="none">
                  <Field label="Waktu Masuk" value={formatDateTime(checkIn)} editable={false} placeholder="01 Jul · 14:00" />
                </View>
              </TouchableOpacity>
              {showCheckIn && Platform.OS !== "android" && (
                <DateTimePicker
                  value={checkIn}
                  mode="datetime"
                  is24Hour
                  display="default"
                  onChange={(_, selectedDate) => {
                    setShowCheckIn(false);
                    if (selectedDate) setCheckIn(selectedDate);
                  }}
                />
              )}

              <TouchableOpacity onPress={() => openDateTimePicker(checkOut && checkOut > checkIn ? checkOut : checkIn, (d) => {
                  if (d <= checkIn) { alert("Waktu keluar harus setelah waktu masuk."); return; }
                  setCheckOut(d);
                }, setShowCheckOut)}>
                <View pointerEvents="none">
                  <Field label="Waktu Keluar" value={formatDateTime(checkOut)} editable={false} placeholder="01 Jul · 16:00 (opsional)" />
                </View>
              </TouchableOpacity>
              {showCheckOut && Platform.OS !== "android" && (
                <DateTimePicker
                  value={checkOut && checkOut > checkIn ? checkOut : checkIn}
                  mode="datetime"
                  minimumDate={checkIn}
                  is24Hour
                  display="default"
                  onChange={(_, selectedDate) => {
                    setShowCheckOut(false);
                    if (selectedDate) setCheckOut(selectedDate);
                  }}
                />
              )}

              <View style={styles.modalActions}>
                <GhostButton label="BATAL" onPress={() => setAddModal(false)} />
                <View style={{ width: Spacing.sm }} />
                <PrimaryButton label="SIMPAN" onPress={handleAddGuest} />
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
  modalActions: {
    flexDirection: "row",
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  modalSub: {
    fontSize: FontSize.base,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
});
