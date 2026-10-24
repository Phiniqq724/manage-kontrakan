import { haptics } from "@/utils/haptics";
import { AppHost, useAppColors } from "@/components/AppHost";
import { BackButton } from "@/components/BackButton";
import { useHideOnScroll } from "@/utils/tab-action";
import { kamarApi, usersApi } from "@/services/api";
import { FormSheet, SheetActions } from "@/components/FormSheet";
import type { Database } from "@/utils/supabase-types";
import Person from "@expo/material-symbols/person.xml";
import {
  Box,
  Column,
  HorizontalDivider,
  Icon,
  PullToRefreshBox,
  Row,
  Text,
  TextButton,
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
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
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
  const hideOnScroll = useHideOnScroll();
  const colors = useAppColors();
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
    haptics.refresh();
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  };

  const handleAssign = async (userId: string | null) => {
    if (!selectedRoom) return;
    const { error } = await kamarApi.assignUser(selectedRoom.id, userId);
    if (error) {
      haptics.error();
      alert(error.message);
      return;
    }
    haptics.success();
    setSelectedRoom(null);
    await loadData();
  };

  const unassignedMembers = members.filter(
    (m) => !rooms.some((r) => r.user_id === m.id),
  );

  return (
    <AppHost style={{ flex: 1 }}>
      <PullToRefreshBox
        isRefreshing={refreshing}
        onRefresh={onRefresh}
        contentAlignment="topCenter"
        modifiers={[fillMaxSize(), background(colors.background)]}
      >
        <Column
          verticalArrangement={{ spacedBy: 16 }}
          modifiers={[fillMaxSize(), hideOnScroll, padding(16, 56, 16, 120)]}
        >
          <Row
            verticalAlignment="center"
            horizontalArrangement={{ spacedBy: 4 }}
            modifiers={[fillMaxWidth()]}
          >
            <BackButton />
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
        <FormSheet
          title={`Kamar ${selectedRoom.room_code}`}
          subtitle={selectedRoom.description ?? "-"}
          onClose={() => setSelectedRoom(null)}
        >
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

          <SheetActions onCancel={() => setSelectedRoom(null)} />
        </FormSheet>
      )}
    </AppHost>
  );
}
