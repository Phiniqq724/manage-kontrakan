import { haptics } from "@/utils/haptics";
import { useAppColors } from "@/components/AppHost";
import { Avatar, avatarColorFor } from "@/components/Avatar";
import { DateTimeField } from "@/components/DateTimeField";
import { FormField } from "@/components/FormField";
import { FormSheet, SheetActions } from "@/components/FormSheet";
import { ChipRow } from "@/components/ListBits";
import { CardLabel } from "@/components/SettingsCard";
import { guestsApi } from "@/services/api";
import { durationLabel } from "@/utils/guest-utils";
import { sendPush } from "@/utils/notifications";
import type { Database } from "@/utils/supabase-types";
import Call from "@expo/material-symbols/call.xml";
import LocalActivity from "@expo/material-symbols/local_activity.xml";
import Person from "@expo/material-symbols/person.xml";
import { Column, Row, Text, type TextFieldRef } from "@expo/ui/jetpack-compose";
import {
  background,
  clip,
  fillMaxWidth,
  paddingAll,
  Shapes,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useRef, useState } from "react";

type GuestRow = Database["public"]["Tables"]["guests"]["Row"];

const ACTIVITIES = ["Main", "Belajar", "Kerja kelompok", "Makan", "Menginap"];
const STAYS: [string, string][] = [
  ["1", "1 jam"],
  ["2", "2 jam"],
  ["3", "3 jam"],
  ["night", "Sampai besok"],
  ["none", "Belum tahu"],
];

const timeLabel = (d: Date) =>
  d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

/** 08.00 the day after `from`, for guests staying the night. */
const nextMorning = (from: Date) => {
  const d = new Date(from);
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  return d;
};

/** Check-out time for a stay chip, relative to check-in. */
const stayEnd = (key: string, from: Date) =>
  key === "none"
    ? undefined
    : key === "night"
      ? nextMorning(from)
      : new Date(from.getTime() + Number(key) * 3600000);

/** Which stay chip matches the current check-out ("custom" when none does). */
const stayKey = (from: Date, to?: Date) =>
  STAYS.find(([k]) => stayEnd(k, from)?.getTime() === to?.getTime())?.[0] ??
  "custom";

/**
 * "Daftarkan tamu" sheet: a live preview of the guest card, quick chips for
 * the activity and how long they stay, and the full fields for anything
 * else. Saves the guest, notifies the other members and hands the new row
 * back through `onSaved`.
 */
export const AddGuestSheet = ({
  user,
  onClose,
  onSaved,
}: {
  user: { id: string; fullname: string };
  onClose: () => void;
  onSaved: (guest: GuestRow) => void;
}) => {
  const colors = useAppColors();
  const activityField = useRef<TextFieldRef>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [activity, setActivity] = useState("");
  const [checkIn, setCheckIn] = useState(() => new Date());
  const [checkOut, setCheckOut] = useState<Date | undefined>();
  const [saving, setSaving] = useState(false);

  const trimmed = name.trim();
  const validOut = !checkOut || checkOut > checkIn;

  const pickActivity = (a: string) => {
    setActivity(a);
    activityField.current?.setText(a);
  };

  // Moving check-in keeps the chosen length of stay.
  const changeCheckIn = (d: Date) => {
    const key = stayKey(checkIn, checkOut);
    setCheckIn(d);
    if (key !== "custom") setCheckOut(stayEnd(key, d));
  };

  async function save() {
    setSaving(true);
    try {
      const { data, error } = await guestsApi.create({
        name: trimmed,
        phone,
        activity,
        check_in: checkIn.toISOString(),
        check_out: checkOut ? checkOut.toISOString() : null,
        invited_by: user.id,
      });
      if (error) throw error;
      haptics.success();
      onSaved(data);
      await sendPush({
        recipients: "all_except_me",
        type: "guest",
        title: "Tamu Baru Didaftarkan",
        body: `${user.fullname} mendaftarkan tamu baru: ${trimmed}.`,
      });
    } catch (err: any) {
      haptics.error();
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormSheet title="Daftarkan tamu" onClose={onClose}>
      {/* Live preview of how the guest will show up in the list. */}
      <Row
        verticalAlignment="center"
        horizontalArrangement={{ spacedBy: 12 }}
        modifiers={[
          fillMaxWidth(),
          clip(Shapes.RoundedCorner(20)),
          background(colors.secondaryContainer),
          paddingAll(16),
        ]}
      >
        <Avatar
          fullname={trimmed || "?"}
          diameter={48}
          colors={avatarColorFor(trimmed || "?", colors)}
        />
        <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[weight(1)]}>
          <Text
            style={{ typography: "titleMedium", fontWeight: "bold" }}
            color={colors.onSecondaryContainer}
            maxLines={1}
            overflow="ellipsis"
          >
            {trimmed || "Nama tamu"}
          </Text>
          <Text style={{ typography: "bodySmall" }} color={colors.onSecondaryContainer}>
            {checkOut && validOut
              ? `${timeLabel(checkIn)} - ${timeLabel(checkOut)} · ${durationLabel(checkIn, checkOut)}`
              : `Masuk ${timeLabel(checkIn)} · keluar belum ditentukan`}
          </Text>
          <Text style={{ typography: "bodySmall" }} color={colors.onSecondaryContainer}>
            {`${activity.trim() || "Tanpa keterangan"} · diundang kamu`}
          </Text>
        </Column>
      </Row>

      <FormField
        label="Nama tamu"
        icon={Person}
        singleLine
        onValueChange={setName}
        keyboardOptions={{ capitalization: "words" }}
      />
      <FormField
        label="No. HP (opsional)"
        icon={Call}
        singleLine
        onValueChange={setPhone}
        keyboardOptions={{ keyboardType: "phone" }}
      />

      <CardLabel>Mau ngapain?</CardLabel>
      <ChipRow
        options={ACTIVITIES.map((a) => [a, a] as [string, string])}
        value={activity}
        onChange={pickActivity}
      />
      <FormField
        ref={activityField}
        label="Kegiatan"
        icon={LocalActivity}
        singleLine
        onValueChange={setActivity}
        keyboardOptions={{ capitalization: "sentences" }}
      />

      <CardLabel>Berapa lama?</CardLabel>
      <DateTimeField label="Waktu masuk" value={checkIn} onChange={changeCheckIn} />
      <ChipRow
        options={STAYS}
        value={stayKey(checkIn, checkOut)}
        onChange={(k) => setCheckOut(stayEnd(k, checkIn))}
      />
      <DateTimeField
        label="Waktu keluar"
        value={checkOut ?? null}
        placeholder="Belum ditentukan"
        minDate={checkIn}
        onChange={(d) =>
          d <= checkIn
            ? alert("Waktu keluar harus setelah waktu masuk.")
            : setCheckOut(d)
        }
      />

      <SheetActions
        onCancel={onClose}
        onSubmit={save}
        submitLabel="Simpan"
        enabled={trimmed.length > 0 && validOut}
        loading={saving}
      />
    </FormSheet>
  );
};
