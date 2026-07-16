import { ButtonContent } from "@/components/ButtonContent";
import { guestsApi, usersApi } from "@/services/api";
import { useAuth } from "@/utils/auth-context";
import {
  getAllTokensExcept,
  sendPushNotification,
} from "@/utils/notifications";
import type { Database } from "@/utils/supabase-types";
import CheckCircle from "@expo/material-symbols/check_circle.xml";
import Edit from "@expo/material-symbols/edit.xml";
import Login from "@expo/material-symbols/login.xml";
import Logout from "@expo/material-symbols/logout.xml";
import Schedule from "@expo/material-symbols/schedule.xml";
import { Host } from "@expo/ui";
import {
  Box,
  Button,
  Column,
  ExtendedFloatingActionButton,
  Icon,
  ModalBottomSheet,
  OutlinedButton,
  OutlinedCard,
  OutlinedTextField,
  PullToRefreshBox,
  Row,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Text,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  align,
  background,
  clickable,
  clip,
  fillMaxSize,
  fillMaxWidth,
  imePadding,
  padding,
  paddingAll,
  Shapes,
  size,
  verticalScroll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useEffect, useState } from "react";

type GuestRow = Database["public"]["Tables"]["guests"]["Row"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];

const parseTs = (s: string) => new Date(s.endsWith("Z") ? s : `${s}Z`);
const firstName = (fullname: string) => fullname.split(" ")[0] ?? fullname;
const timeLabel = (d: Date) =>
  d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
const dateTimeLabel = (d: Date) =>
  `${d.getDate().toString().padStart(2, "0")} ${d.toLocaleString("id-ID", { month: "short" })} · ${timeLabel(d)}`;

function durationLabel(inD: Date, outD: Date) {
  const mins = Math.max(
    0,
    Math.round((outD.getTime() - inD.getTime()) / 60000),
  );
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
}

function openDateTimePicker(current: Date, onSelect: (d: Date) => void) {
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
}

export default function GuestsScreen() {
  const { user } = useAuth();
  const colors = useMaterialColors();

  const [rawGuests, setRawGuests] = useState<GuestRow[]>([]);
  const [users, setUsers] = useState<Record<string, UserRow>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [segment, setSegment] = useState<"inside" | "semua">("inside");

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [activity, setActivity] = useState("");
  const [checkIn, setCheckIn] = useState<Date>(new Date());
  const [checkOut, setCheckOut] = useState<Date | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadGuests();
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
    setRefreshing(true);
    loadGuests().finally(() => setRefreshing(false));
  };

  async function handleAddGuest() {
    if (checkOut && checkOut <= checkIn) {
      alert("Waktu keluar harus setelah waktu masuk.");
      return;
    }
    setSaving(true);
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
        setAddOpen(false);
        setName("");
        setPhone("");
        setActivity("");
        setCheckIn(new Date());
        setCheckOut(undefined);
        if (user?.id) {
          const tokens = await getAllTokensExcept(user.id);
          await Promise.all(
            tokens.map((token) =>
              sendPushNotification(
                token,
                "Tamu Baru Didaftarkan",
                `${user.fullname} mendaftarkan tamu baru: ${name}.`,
              ),
            ),
          );
        }
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCheckOut(id: string) {
    try {
      const nowIso = new Date().toISOString();
      const { error } = await guestsApi.update(id, { check_out: nowIso });
      if (error) throw error;
      setRawGuests((prev) =>
        prev.map((g) => (g.id === id ? { ...g, check_out: nowIso } : g)),
      );
    } catch (err: any) {
      alert(err.message);
    }
  }

  const insideGuests = rawGuests
    .filter((g) => !g.check_out)
    .sort(
      (a, b) => parseTs(b.check_in).getTime() - parseTs(a.check_in).getTime(),
    );

  const todayStr = new Date().toDateString();
  const checkedOutToday = rawGuests
    .filter(
      (g) => g.check_out && parseTs(g.check_out).toDateString() === todayStr,
    )
    .sort(
      (a, b) =>
        parseTs(b.check_out!).getTime() - parseTs(a.check_out!).getTime(),
    );

  const allSorted = rawGuests
    .slice()
    .sort(
      (a, b) => parseTs(b.check_in).getTime() - parseTs(a.check_in).getTime(),
    );

  const inviterLabel = (g: GuestRow) =>
    g.invited_by === user?.id
      ? "kamu"
      : firstName(users[g.invited_by ?? ""]?.fullname ?? "Seseorang");

  return (
    <Host style={{ flex: 1 }}>
      <Box modifiers={[fillMaxSize()]}>
        <PullToRefreshBox
          isRefreshing={refreshing}
          onRefresh={onRefresh}
          contentAlignment="topCenter"
          modifiers={[fillMaxSize(), background(colors.background)]}
        >
          <Column
            verticalArrangement={{ spacedBy: 20 }}
            modifiers={[
              fillMaxSize(),
              verticalScroll(),
              padding(16, 56, 16, 100),
            ]}
          >
            <Text
              style={{ typography: "headlineMedium", fontWeight: "bold" }}
              color={colors.onBackground}
            >
              Tamu
            </Text>

            <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
              <SegmentedButton
                selected={segment === "inside"}
                onClick={() => setSegment("inside")}
              >
                <SegmentedButton.Label>
                  <Text>{`Di dalam · ${insideGuests.length}`}</Text>
                </SegmentedButton.Label>
              </SegmentedButton>
              <SegmentedButton
                selected={segment === "semua"}
                onClick={() => setSegment("semua")}
              >
                <SegmentedButton.Label>
                  <Text>Semua</Text>
                </SegmentedButton.Label>
              </SegmentedButton>
            </SingleChoiceSegmentedButtonRow>

            {segment === "inside" ? (
              <>
                <Column verticalArrangement={{ spacedBy: 12 }}>
                  {insideGuests.length === 0 && (
                    <Text
                      style={{ typography: "bodyMedium" }}
                      color={colors.onSurfaceVariant}
                    >
                      Tidak ada tamu di dalam saat ini.
                    </Text>
                  )}
                  {insideGuests.map((g) => (
                    <OutlinedCard key={g.id} modifiers={[fillMaxWidth()]}>
                      <Row
                        verticalAlignment="center"
                        horizontalArrangement={{ spacedBy: 12 }}
                        modifiers={[paddingAll(16)]}
                      >
                        <Box
                          contentAlignment="center"
                          modifiers={[
                            size(40, 40),
                            clip(Shapes.RoundedCorner(20)),
                            background(colors.primaryContainer),
                          ]}
                        >
                          <Text
                            style={{
                              typography: "titleMedium",
                              fontWeight: "bold",
                            }}
                            color={colors.onPrimaryContainer}
                          >
                            {g.name[0]?.toUpperCase() ?? "?"}
                          </Text>
                        </Box>
                        <Column
                          verticalArrangement={{ spacedBy: 2 }}
                          modifiers={[weight(1)]}
                        >
                          <Text
                            style={{
                              typography: "bodyLarge",
                              fontWeight: "bold",
                            }}
                            color={colors.onSurface}
                          >
                            {g.name}
                          </Text>
                          <Text
                            style={{ typography: "bodySmall" }}
                            color={colors.onSurfaceVariant}
                          >
                            {`Masuk ${timeLabel(parseTs(g.check_in))} · diundang ${inviterLabel(g)}`}
                          </Text>
                        </Column>
                        {g.invited_by === user?.id && (
                          <Button onClick={() => handleCheckOut(g.id)}>
                            <Text
                              style={{
                                typography: "labelLarge",
                                fontWeight: "bold",
                              }}
                              color={colors.onPrimary}
                            >
                              Checkout
                            </Text>
                          </Button>
                        )}
                      </Row>
                    </OutlinedCard>
                  ))}
                </Column>

                {checkedOutToday.length > 0 && (
                  <Column verticalArrangement={{ spacedBy: 8 }}>
                    <Text
                      style={{
                        typography: "labelLarge",
                        fontWeight: "bold",
                        letterSpacing: 0.5,
                      }}
                      color={colors.onSurfaceVariant}
                    >
                      SUDAH KELUAR HARI INI
                    </Text>
                    {checkedOutToday.map((g) => (
                      <Row
                        key={g.id}
                        verticalAlignment="center"
                        horizontalArrangement={{ spacedBy: 12 }}
                        modifiers={[padding(0, 8, 0, 8)]}
                      >
                        <Box
                          contentAlignment="center"
                          modifiers={[
                            size(36, 36),
                            clip(Shapes.RoundedCorner(18)),
                            background(colors.secondaryContainer),
                          ]}
                        >
                          <Text
                            style={{
                              typography: "titleSmall",
                              fontWeight: "bold",
                            }}
                            color={colors.onSecondaryContainer}
                          >
                            {g.name[0]?.toUpperCase() ?? "?"}
                          </Text>
                        </Box>
                        <Column
                          verticalArrangement={{ spacedBy: 2 }}
                          modifiers={[weight(1)]}
                        >
                          <Text
                            style={{ typography: "bodyMedium" }}
                            color={colors.onSurface}
                          >
                            {g.name}
                          </Text>
                          <Text
                            style={{ typography: "bodySmall" }}
                            color={colors.onSurfaceVariant}
                          >
                            {`${timeLabel(parseTs(g.check_in))} — ${timeLabel(parseTs(g.check_out!))} · ${durationLabel(parseTs(g.check_in), parseTs(g.check_out!))}`}
                          </Text>
                        </Column>
                        <Icon
                          source={CheckCircle}
                          tint={colors.onSurfaceVariant}
                          size={18}
                        />
                      </Row>
                    ))}
                  </Column>
                )}
              </>
            ) : (
              <Column verticalArrangement={{ spacedBy: 4 }}>
                {allSorted.length === 0 && (
                  <Text
                    style={{ typography: "bodyMedium" }}
                    color={colors.onSurfaceVariant}
                  >
                    Belum ada tamu.
                  </Text>
                )}
                {allSorted.map((g) => (
                  <Row
                    key={g.id}
                    verticalAlignment="center"
                    horizontalArrangement={{ spacedBy: 12 }}
                    modifiers={[padding(0, 10, 0, 10)]}
                  >
                    <Text
                      style={{ typography: "labelMedium", fontWeight: "bold" }}
                      color={colors.onSurfaceVariant}
                    >
                      {parseTs(g.check_in)
                        .toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                        })
                        .toUpperCase()}
                    </Text>
                    <Box
                      contentAlignment="center"
                      modifiers={[
                        size(36, 36),
                        clip(Shapes.RoundedCorner(18)),
                        background(colors.primaryContainer),
                      ]}
                    >
                      <Text
                        style={{ typography: "titleSmall", fontWeight: "bold" }}
                        color={colors.onPrimaryContainer}
                      >
                        {g.name[0]?.toUpperCase() ?? "?"}
                      </Text>
                    </Box>
                    <Column
                      verticalArrangement={{ spacedBy: 2 }}
                      modifiers={[weight(1)]}
                    >
                      <Text
                        style={{ typography: "bodyMedium" }}
                        color={colors.onSurface}
                      >
                        {g.name}
                      </Text>
                      <Text
                        style={{ typography: "bodySmall" }}
                        color={colors.onSurfaceVariant}
                      >
                        {`Diundang ${inviterLabel(g)}`}
                      </Text>
                    </Column>
                    <Icon
                      source={g.check_out ? Logout : Login}
                      tint={
                        g.check_out ? colors.onSurfaceVariant : colors.primary
                      }
                      size={20}
                    />
                  </Row>
                ))}
              </Column>
            )}
          </Column>
        </PullToRefreshBox>

        <ExtendedFloatingActionButton
          onClick={() => setAddOpen(true)}
          modifiers={[align("bottomEnd"), padding(0, 0, 20, 24)]}
        >
          <ExtendedFloatingActionButton.Icon>
            <Icon source={Edit} size={20} />
          </ExtendedFloatingActionButton.Icon>
          <ExtendedFloatingActionButton.Text>
            <Text style={{ typography: "labelLarge", fontWeight: "bold" }}>
              Daftarkan tamu
            </Text>
          </ExtendedFloatingActionButton.Text>
        </ExtendedFloatingActionButton>
      </Box>

      {addOpen && (
        <ModalBottomSheet onDismissRequest={() => setAddOpen(false)}>
          <Column
            verticalArrangement={{ spacedBy: 16 }}
            modifiers={[
              fillMaxWidth(),
              verticalScroll(),
              imePadding(),
              padding(24, 8, 24, 32),
            ]}
          >
            <Text
              style={{ typography: "headlineSmall", fontWeight: "bold" }}
              color={colors.onSurface}
            >
              Daftarkan tamu
            </Text>

            <OutlinedTextField
              singleLine
              onValueChange={setName}
              keyboardOptions={{ capitalization: "words" }}
              modifiers={[fillMaxWidth()]}
            >
              <OutlinedTextField.Label>
                <Text>Nama tamu</Text>
              </OutlinedTextField.Label>
            </OutlinedTextField>

            <OutlinedTextField
              singleLine
              onValueChange={setPhone}
              keyboardOptions={{ keyboardType: "phone" }}
              modifiers={[fillMaxWidth()]}
            >
              <OutlinedTextField.Label>
                <Text>No. HP</Text>
              </OutlinedTextField.Label>
            </OutlinedTextField>

            <OutlinedTextField
              singleLine
              onValueChange={setActivity}
              keyboardOptions={{ capitalization: "sentences" }}
              modifiers={[fillMaxWidth()]}
            >
              <OutlinedTextField.Label>
                <Text>Kegiatan</Text>
              </OutlinedTextField.Label>
            </OutlinedTextField>

            <OutlinedCard
              modifiers={[fillMaxWidth(), clickable(() => openDateTimePicker(checkIn, setCheckIn))]}
            >
              <Row
                verticalAlignment="center"
                horizontalArrangement="spaceBetween"
                modifiers={[fillMaxWidth(), padding(16, 14, 16, 14)]}
              >
                <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[weight(1)]}>
                  <Text
                    style={{ typography: "labelMedium" }}
                    color={colors.onSurfaceVariant}
                    overflow="ellipsis"
                    maxLines={1}
                  >
                    Waktu masuk
                  </Text>
                  <Text
                    style={{ typography: "bodyLarge" }}
                    color={colors.onSurface}
                    overflow="ellipsis"
                    maxLines={1}
                  >
                    {dateTimeLabel(checkIn)}
                  </Text>
                </Column>
                <Icon
                  source={Schedule}
                  tint={colors.onSurfaceVariant}
                  size={20}
                />
              </Row>
            </OutlinedCard>

            <OutlinedCard
              modifiers={[
                fillMaxWidth(),
                clickable(() =>
                  openDateTimePicker(
                    checkOut && checkOut > checkIn ? checkOut : checkIn,
                    (d) => {
                      if (d <= checkIn) {
                        alert("Waktu keluar harus setelah waktu masuk.");
                        return;
                      }
                      setCheckOut(d);
                    },
                  ),
                ),
              ]}
            >
              <Row
                verticalAlignment="center"
                horizontalArrangement="spaceBetween"
                modifiers={[fillMaxWidth(), padding(16, 14, 16, 14)]}
              >
                <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[weight(1)]}>
                  <Text
                    style={{ typography: "labelMedium" }}
                    color={colors.onSurfaceVariant}
                    overflow="ellipsis"
                    maxLines={1}
                  >
                    Waktu keluar (opsional)
                  </Text>
                  <Text
                    style={{ typography: "bodyLarge" }}
                    color={colors.onSurface}
                    overflow="ellipsis"
                    maxLines={1}
                  >
                    {checkOut ? dateTimeLabel(checkOut) : "Belum diatur"}
                  </Text>
                </Column>
                <Icon
                  source={Schedule}
                  tint={colors.onSurfaceVariant}
                  size={20}
                />
              </Row>
            </OutlinedCard>

            <Row
              verticalAlignment="center"
              horizontalArrangement={{ spacedBy: 12 }}
              modifiers={[fillMaxWidth()]}
            >
              <OutlinedButton
                onClick={() => setAddOpen(false)}
                modifiers={[weight(1)]}
              >
                <Text
                  style={{ typography: "labelLarge" }}
                  color={colors.primary}
                >
                  Batal
                </Text>
              </OutlinedButton>
              <Button
                enabled={!saving}
                onClick={handleAddGuest}
                modifiers={[weight(1)]}
              >
                <ButtonContent loading={saving} label="Simpan" color={colors.onPrimary} />
              </Button>
            </Row>
          </Column>
        </ModalBottomSheet>
      )}
    </Host>
  );
}
