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
import {
  GhostButton,
  PageHeader,
  PrimaryButton,
  Rule,
  SectionHeader,
} from "../../components/UI";
import { Colors, FontSize, Radius, Spacing } from "../../constants/theme";
import { kamarApi, usersApi } from "../../services/api";
import type { Database } from "../../utils/supabase-types";

type KamarRow = Database["public"]["Tables"]["kamar"]["Row"] & {
  users: {
    id: string;
    fullname: string;
    username: string;
    avatar_url: string | null;
  } | null;
};
type UserRow = Database["public"]["Tables"]["users"]["Row"];

export default function AdminKamarScreen() {
  const [rooms, setRooms] = useState<KamarRow[]>([]);
  const [members, setMembers] = useState<UserRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<KamarRow | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [roomsRes, membersRes] = await Promise.all([
      kamarApi.getAll(),
      usersApi.getAll(),
    ]);
    if (roomsRes.data) setRooms(roomsRes.data as KamarRow[]);
    if (membersRes.data) setMembers(membersRes.data);
  }

  const openAssign = (room: KamarRow) => {
    setSelectedRoom(room);
    setModal(true);
  };

  const handleAssign = async (userId: string | null) => {
    if (!selectedRoom) return;
    await kamarApi.assignUser(selectedRoom.id, userId);
    setModal(false);
    await loadData();
  };

  const unassignedMembers = members.filter(
    (m) => !rooms.some((r) => r.user_id === m.id),
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
        <PageHeader title="KAMAR" subtitle="Kelola penugasan kamar penghuni" />
        <SectionHeader label={`${rooms.length} Kamar`} />
        <Rule />

        {rooms.map((room, i) => (
          <View key={room.id}>
            <TouchableOpacity
              style={styles.roomRow}
              onPress={() => openAssign(room)}
              activeOpacity={0.6}
            >
              <View style={styles.roomCode}>
                <Text style={styles.roomCodeText}>{room.room_code}</Text>
              </View>
              <View style={styles.roomInfo}>
                <Text style={styles.roomOccupant}>
                  {room.users?.fullname ?? "Kosong"}
                </Text>
                <Text style={styles.roomDesc} numberOfLines={1}>
                  {room.description ?? "-"}
                </Text>
              </View>
              <Ionicons
                name={room.user_id ? "person" : "person-outline"}
                size={16}
                color={room.user_id ? Colors.sage : Colors.textFaint}
              />
            </TouchableOpacity>
            {i < rooms.length - 1 && <Rule />}
          </View>
        ))}
      </ScrollView>

      <Modal visible={modal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              KAMAR {selectedRoom?.room_code}
            </Text>
            <Text style={styles.modalSub}>
              {selectedRoom?.description ?? "-"}
            </Text>
            <Rule style={{ marginVertical: Spacing.md }} />

            {selectedRoom?.user_id && (
              <>
                <Text style={styles.sectionLabel}>PENGHUNI SAAT INI</Text>
                <View style={styles.currentOccupant}>
                  <Text style={styles.currentOccupantName}>
                    {selectedRoom.users?.fullname}
                  </Text>
                  <TouchableOpacity onPress={() => handleAssign(null)}>
                    <Text style={styles.unassignText}>Lepas</Text>
                  </TouchableOpacity>
                </View>
                <Rule style={{ marginVertical: Spacing.md }} />
              </>
            )}

            <Text style={styles.sectionLabel}>
              {selectedRoom?.user_id ? "PINDAHKAN KE" : "TUGASKAN KE"}
            </Text>
            <ScrollView style={{ maxHeight: 240 }}>
              {unassignedMembers.length === 0 ? (
                <Text style={styles.emptyText}>
                  Semua penghuni sudah punya kamar.
                </Text>
              ) : (
                unassignedMembers.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={styles.memberOption}
                    onPress={() => handleAssign(m.id)}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.memberOptionName}>{m.fullname}</Text>
                    <Text style={styles.memberOptionSub}>{m.username}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <GhostButton label="BATAL" onPress={() => setModal(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingBottom: Spacing.xl },
  roomRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  roomCode: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  roomCodeText: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.sm,
    color: Colors.accent,
    letterSpacing: 1,
  },
  roomInfo: { flex: 1 },
  roomOccupant: { fontSize: FontSize.base, color: Colors.text },
  roomDesc: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
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
    maxHeight: "80%",
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
  sectionLabel: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  currentOccupant: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  currentOccupantName: { fontSize: FontSize.base, color: Colors.text },
  unassignText: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.xs,
    color: Colors.danger,
    letterSpacing: 1,
  },
  memberOption: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  memberOptionName: { fontSize: FontSize.base, color: Colors.text },
  memberOptionSub: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    paddingVertical: Spacing.md,
  },
  modalActions: { marginTop: Spacing.lg },
});
