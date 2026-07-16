import { kamarApi, usersApi } from "@/services/api";
import type { Database } from "@/utils/supabase-types";
import ArrowBack from "@expo/material-symbols/arrow_back.xml";
import Person from "@expo/material-symbols/person.xml";
import { Host } from "@expo/ui";
import {
  Box,
  Column,
  HorizontalDivider,
  Icon,
  IconButton,
  ModalBottomSheet,
  PullToRefreshBox,
  Row,
  Text,
  TextButton,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  background,
  clickable,
  clip,
  fillMaxSize,
  fillMaxWidth,
  padding,
  Shapes,
  size,
  verticalScroll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { router } from "expo-router";
import { useEffect, useState } from "react";

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
  const colors = useMaterialColors();
  const [rooms, setRooms] = useState<KamarRow[]>([]);
  const [members, setMembers] = useState<UserRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
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

  const onRefresh = () => {
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  };

  const handleAssign = async (userId: string | null) => {
    if (!selectedRoom) return;
    await kamarApi.assignUser(selectedRoom.id, userId);
    setSelectedRoom(null);
    await loadData();
  };

  const unassignedMembers = members.filter(
    (m) => !rooms.some((r) => r.user_id === m.id),
  );

  return (
    <Host style={{ flex: 1 }}>
      <PullToRefreshBox
        isRefreshing={refreshing}
        onRefresh={onRefresh}
        contentAlignment="topCenter"
        modifiers={[fillMaxSize(), background(colors.background)]}
      >
        <Column
          verticalArrangement={{ spacedBy: 16 }}
          modifiers={[fillMaxSize(), verticalScroll(), padding(16, 56, 16, 32)]}
        >
          <Row
            verticalAlignment="center"
            horizontalArrangement={{ spacedBy: 4 }}
            modifiers={[fillMaxWidth()]}
          >
            <IconButton onClick={() => router.back()}>
              <Icon source={ArrowBack} tint={colors.onSurface} size={22} />
            </IconButton>
            <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[weight(1)]}>
              <Text
                style={{ typography: "titleLarge", fontWeight: "bold" }}
                color={colors.onBackground}
              >
                Kamar
              </Text>
              <Text
                style={{ typography: "bodySmall" }}
                color={colors.onSurfaceVariant}
              >
                Kelola penugasan kamar penghuni
              </Text>
            </Column>
          </Row>

          <Text
            style={{ typography: "labelLarge", fontWeight: "bold" }}
            color={colors.onSurfaceVariant}
          >
            {`${rooms.length} kamar`}
          </Text>

          <Column>
            {rooms.map((room, i) => (
              <Column key={room.id}>
                <Row
                  verticalAlignment="center"
                  horizontalArrangement={{ spacedBy: 12 }}
                  modifiers={[
                    fillMaxWidth(),
                    clickable(() => setSelectedRoom(room)),
                    padding(0, 12, 0, 12),
                  ]}
                >
                  <Box
                    contentAlignment="center"
                    modifiers={[
                      size(44, 44),
                      clip(Shapes.RoundedCorner(12)),
                      background(colors.secondaryContainer),
                    ]}
                  >
                    <Text
                      style={{ typography: "labelMedium", fontWeight: "bold" }}
                      color={colors.onSecondaryContainer}
                    >
                      {room.room_code}
                    </Text>
                  </Box>
                  <Column
                    verticalArrangement={{ spacedBy: 2 }}
                    modifiers={[weight(1)]}
                  >
                    <Text
                      style={{ typography: "bodyLarge", fontWeight: "600" }}
                      color={colors.onSurface}
                    >
                      {room.users?.fullname ?? "Kosong"}
                    </Text>
                    <Text
                      style={{ typography: "bodySmall" }}
                      color={colors.onSurfaceVariant}
                      overflow="ellipsis"
                      maxLines={1}
                    >
                      {room.description ?? "-"}
                    </Text>
                  </Column>
                  <Icon
                    source={Person}
                    tint={room.user_id ? colors.primary : colors.onSurfaceVariant}
                    size={18}
                  />
                </Row>
                {i < rooms.length - 1 && (
                  <HorizontalDivider color={colors.outlineVariant} />
                )}
              </Column>
            ))}
          </Column>
        </Column>
      </PullToRefreshBox>

      {selectedRoom && (
        <ModalBottomSheet onDismissRequest={() => setSelectedRoom(null)}>
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
                {`Kamar ${selectedRoom.room_code}`}
              </Text>
              <Text
                style={{ typography: "bodyMedium" }}
                color={colors.onSurfaceVariant}
              >
                {selectedRoom.description ?? "-"}
              </Text>
            </Column>

            {selectedRoom.user_id && (
              <>
                <HorizontalDivider color={colors.outlineVariant} />
                <Column verticalArrangement={{ spacedBy: 8 }}>
                  <Text
                    style={{ typography: "labelLarge", fontWeight: "bold" }}
                    color={colors.onSurfaceVariant}
                  >
                    Penghuni saat ini
                  </Text>
                  <Row
                    verticalAlignment="center"
                    horizontalArrangement="spaceBetween"
                    modifiers={[fillMaxWidth()]}
                  >
                    <Text
                      style={{ typography: "bodyLarge" }}
                      color={colors.onSurface}
                    >
                      {selectedRoom.users?.fullname}
                    </Text>
                    <TextButton onClick={() => handleAssign(null)}>
                      <Text
                        style={{ typography: "labelLarge" }}
                        color={colors.error}
                      >
                        Lepas
                      </Text>
                    </TextButton>
                  </Row>
                </Column>
              </>
            )}

            <HorizontalDivider color={colors.outlineVariant} />

            <Text
              style={{ typography: "labelLarge", fontWeight: "bold" }}
              color={colors.onSurfaceVariant}
            >
              {selectedRoom.user_id ? "Pindahkan ke" : "Tugaskan ke"}
            </Text>

            {unassignedMembers.length === 0 ? (
              <Text
                style={{ typography: "bodyMedium" }}
                color={colors.onSurfaceVariant}
              >
                Semua penghuni sudah punya kamar.
              </Text>
            ) : (
              <Column>
                {unassignedMembers.map((m, i) => (
                  <Column key={m.id}>
                    <Row
                      verticalAlignment="center"
                      modifiers={[
                        fillMaxWidth(),
                        clickable(() => handleAssign(m.id)),
                        padding(0, 12, 0, 12),
                      ]}
                    >
                      <Column verticalArrangement={{ spacedBy: 2 }}>
                        <Text
                          style={{ typography: "bodyLarge" }}
                          color={colors.onSurface}
                        >
                          {m.fullname}
                        </Text>
                        <Text
                          style={{ typography: "bodySmall" }}
                          color={colors.onSurfaceVariant}
                        >
                          {m.username}
                        </Text>
                      </Column>
                    </Row>
                    {i < unassignedMembers.length - 1 && (
                      <HorizontalDivider color={colors.outlineVariant} />
                    )}
                  </Column>
                ))}
              </Column>
            )}

            <TextButton
              onClick={() => setSelectedRoom(null)}
              modifiers={[fillMaxWidth()]}
            >
              <Text
                style={{ typography: "labelLarge" }}
                color={colors.onSurfaceVariant}
              >
                Batal
              </Text>
            </TextButton>
          </Column>
        </ModalBottomSheet>
      )}
    </Host>
  );
}
