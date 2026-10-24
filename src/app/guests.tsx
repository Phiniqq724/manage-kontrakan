import { haptics } from "@/utils/haptics";
import { AppHost, useAppColors } from "@/components/AppHost";
import { Avatar, avatarColorFor } from "@/components/Avatar";
import { AddGuestSheet } from "@/components/AddGuestSheet";
import { GuestCard } from "@/components/GuestCard";
import { guestsApi, usersApi } from "@/services/api";
import { useAuth } from "@/utils/auth-context";
import { groupByDay, parseTs } from "@/utils/guest-utils";
import { useHideOnScroll, useTabAction } from "@/utils/tab-action";
import type { Database } from "@/utils/supabase-types";
import PersonAdd from "@expo/material-symbols/person_add.xml";
import PersonOff from "@expo/material-symbols/person_off.xml";
import {
  Box,
  Button,
  Card,
  Column,
  Icon,
  PullToRefreshBox,
  Row,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  SnackbarHost,
  type SnackbarHostRef,
  Text,
} from "@expo/ui/jetpack-compose";
import {
  align,
  background,
  clickable,
  fillMaxSize,
  fillMaxWidth,
  padding,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useEffect, useRef, useState } from "react";

type GuestRow = Database["public"]["Tables"]["guests"]["Row"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];

const firstName = (fullname: string) => fullname.split(" ")[0] ?? fullname;

export default function GuestsScreen() {
  const hideOnScroll = useHideOnScroll();
  const { user } = useAuth();
  const colors = useAppColors();

  const [rawGuests, setRawGuests] = useState<GuestRow[]>([]);
  const [users, setUsers] = useState<Record<string, UserRow>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [segment, setSegment] = useState<"inside" | "riwayat">("inside");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const snackbar = useRef<SnackbarHostRef>(null);

  const [addOpen, setAddOpen] = useState(false);
  useTabAction("guests", PersonAdd, () => setAddOpen(true));

  useEffect(() => {
    loadGuests();
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  async function loadGuests() {
    const [guestRes, userRes] = await Promise.all([
      guestsApi.getAll(),
      usersApi.getAll(),
    ]);
    if (guestRes.data) setRawGuests(guestRes.data);
    const map: Record<string, UserRow> = {};
    (userRes.data ?? []).forEach((u) => {
      map[u.id] = u;
    });
    setUsers(map);
  }

  const onRefresh = () => {
    haptics.refresh();
    setRefreshing(true);
    loadGuests().finally(() => setRefreshing(false));
  };

  async function handleCheckOut(g: GuestRow) {
    try {
      const { error } = await guestsApi.update(g.id, { check_out: new Date().toISOString() });
      if (error) throw error;
      haptics.success();
      loadGuests();
      const res = await snackbar.current?.showSnackbar({
        message: `${g.name} sudah keluar`,
        actionLabel: "Urungkan",
      });
      if (res === "actionPerformed") {
        await guestsApi.update(g.id, { check_out: null });
        loadGuests();
      }
    } catch (err: any) {
      haptics.error();
      alert(err.message);
    }
  }

  const inside = rawGuests
    .filter((g) => !g.check_out)
    .sort((a, b) => parseTs(b.check_in).getTime() - parseTs(a.check_in).getTime());
  const today = rawGuests.filter(
    (g) => parseTs(g.check_in).toDateString() === now.toDateString(),
  ).length;
  const shown = segment === "inside" ? [{ label: "", items: inside }] : groupByDay(rawGuests, now);
  const inviterLabel = (g: GuestRow) =>
    g.invited_by === user?.id
      ? "kamu"
      : firstName(users[g.invited_by ?? ""]?.fullname ?? "Seseorang");
  const muted = colors.onSurfaceVariant;

  return (
    <AppHost style={{ flex: 1 }}>
      <Box modifiers={[fillMaxSize()]}>
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
            <Text style={{ typography: "headlineMedium", fontWeight: "bold" }} color={colors.onBackground}>
              Tamu
            </Text>

            <Card
              colors={{ containerColor: colors.primaryContainer, contentColor: colors.onPrimaryContainer }}
              modifiers={[fillMaxWidth(), clickable(() => setSegment(segment === "inside" ? "riwayat" : "inside"))]}
            >
              <Row
                verticalAlignment="center"
                horizontalArrangement={{ spacedBy: 16 }}
                modifiers={[fillMaxWidth(), padding(20, 16, 20, 16)]}
              >
                <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[weight(1)]}>
                  <Text style={{ typography: "labelLarge" }} color={colors.onPrimaryContainer}>
                    Di dalam sekarang
                  </Text>
                  <Text style={{ typography: "displaySmall", fontWeight: "bold" }} color={colors.onPrimaryContainer}>
                    {String(inside.length)}
                  </Text>
                  <Text style={{ typography: "bodySmall" }} color={colors.onPrimaryContainer}>
                    {`Hari ini: ${today} tamu`}
                  </Text>
                </Column>
                <Row horizontalArrangement={{ spacedBy: -8 }} verticalAlignment="center">
                  {inside.slice(0, 4).map((g) => (
                    <Avatar key={g.id} fullname={g.name} diameter={36} colors={avatarColorFor(g.id, colors)} />
                  ))}
                  {inside.length > 4 && (
                    <Text style={{ typography: "labelLarge", fontWeight: "bold" }} color={colors.onPrimaryContainer}>
                      {`  +${inside.length - 4}`}
                    </Text>
                  )}
                </Row>
              </Row>
            </Card>

            <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
              {(["inside", "riwayat"] as const).map((key) => (
                <SegmentedButton key={key} selected={segment === key} onClick={() => {
                  if (segment !== key) haptics.tick();
                  setSegment(key);
                }}>
                  <SegmentedButton.Label>
                    <Text>
                      {key === "inside" ? `Di dalam · ${inside.length}` : `Riwayat · ${rawGuests.length}`}
                    </Text>
                  </SegmentedButton.Label>
                </SegmentedButton>
              ))}
            </SingleChoiceSegmentedButtonRow>

            {shown.every((grp) => grp.items.length === 0) ? (
              <Column
                horizontalAlignment="center"
                verticalArrangement={{ spacedBy: 12 }}
                modifiers={[fillMaxWidth(), padding(0, 32, 0, 0)]}
              >
                <Icon source={PersonOff} tint={muted} size={48} />
                <Text style={{ typography: "bodyMedium" }} color={muted}>
                  {segment === "inside" ? "Tidak ada tamu di dalam saat ini." : "Belum ada tamu."}
                </Text>
                <Button onClick={() => setAddOpen(true)}>
                  <Icon source={PersonAdd} tint={colors.onPrimary} size={18} />
                  <Text style={{ typography: "labelLarge", fontWeight: "bold" }} color={colors.onPrimary}>
                    {"  Daftarkan tamu"}
                  </Text>
                </Button>
              </Column>
            ) : (
              shown.map((grp) => (
                <Column key={grp.label} verticalArrangement={{ spacedBy: 8 }}>
                  {grp.label !== "" && (
                    <Text style={{ typography: "titleSmall", fontWeight: "bold" }} color={muted}>
                      {grp.label}
                    </Text>
                  )}
                  {grp.items.map((g) => (
                    <GuestCard
                      key={g.id}
                      guest={g}
                      inviter={inviterLabel(g)}
                      now={now}
                      expanded={expandedId === g.id}
                      onToggle={() => setExpandedId(expandedId === g.id ? null : g.id)}
                      onCheckOut={g.invited_by === user?.id ? () => handleCheckOut(g) : undefined}
                    />
                  ))}
                </Column>
              ))
            )}
          </Column>
        </PullToRefreshBox>
        <SnackbarHost ref={snackbar} modifiers={[align("bottomCenter"), padding(16, 0, 16, 96)]} />
      </Box>

      {addOpen && user && (
        <AddGuestSheet
          user={user}
          onClose={() => setAddOpen(false)}
          onSaved={(g) => {
            setRawGuests((prev) => [g, ...prev]);
            setAddOpen(false);
            snackbar.current?.showSnackbar({ message: `${g.name} didaftarkan` });
          }}
        />
      )}
    </AppHost>
  );
}
