import { AppHost, useAppColors } from "@/components/AppHost";
import { BackButton } from "@/components/BackButton";
import { FormSheet, SheetActions } from "@/components/FormSheet";
import { useAuth } from "@/utils/auth-context";
import { hueToHex, readableOn } from "@/utils/color";
import {
  NOTIFICATION_TYPES,
  getMutedTypes,
  setMutedTypes,
  type NotificationType,
} from "@/utils/notifications";
import {
  COLOR_PRESETS,
  TEXT_SCALES,
  useNavItems,
  useQuickActions,
  useSettings,
  type NavLabels,
  type NavStyle,
  type ThemeMode,
} from "@/utils/settings";
import { ActionPicker } from "@/components/QuickActionEditor";
import { CardLabel, SettingsCard } from "@/components/SettingsCard";
import { useHideOnScroll } from "@/utils/tab-action";
import { textScaleSupported } from "../../modules/scroll-reporter";
import Add from "@expo/material-symbols/add.xml";
import Check from "@expo/material-symbols/check.xml";
import PhotoLibrary from "@expo/material-symbols/photo_library.xml";
import {
  Box,
  Column,
  FlowRow,
  Icon,
  OutlinedButton,
  Row,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Slider,
  Switch,
  Text,
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
import { useEffect, useState, type ReactNode } from "react";
import { Alert } from "react-native";

const THEME_MODES: [ThemeMode, string][] = [
  ["system", "Sistem"],
  ["light", "Terang"],
  ["dark", "Gelap"],
];
const NAV_LABELS: [NavLabels, string][] = [
  ["active", "Aktif saja"],
  ["none", "Tanpa label"],
];
const NAV_STYLES: [NavStyle, string][] = [
  ["floating", "Melayang"],
  ["classic", "Klasik"],
];
const SCALE_LABELS = ["Kecil", "Normal", "Besar", "BESAR"];

/** Segmented control for a small list of [value, label] options. */
const Segmented = <T,>({
  options,
  value,
  onChange,
  enabled = true,
}: {
  options: [T, string][];
  value: T;
  onChange: (v: T) => void;
  enabled?: boolean;
}) => (
  <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
    {options.map(([v, label]) => (
      <SegmentedButton
        key={label}
        selected={v === value}
        enabled={enabled}
        onClick={() => onChange(v)}
      >
        <SegmentedButton.Label>
          <Text style={{ typography: "labelMedium" }}>{label}</Text>
        </SegmentedButton.Label>
      </SegmentedButton>
    ))}
  </SingleChoiceSegmentedButtonRow>
);

/** Label (+ optional hint) on the left, any control on the right. */
const SettingRow = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) => {
  const colors = useAppColors();
  return (
    <Row
      verticalAlignment="center"
      horizontalArrangement={{ spacedBy: 12 }}
      modifiers={[fillMaxWidth()]}
    >
      <Column modifiers={[weight(1)]}>
        <Text style={{ typography: "bodyLarge" }} color={colors.onSurface}>
          {label}
        </Text>
        {hint ? (
          <Text
            style={{ typography: "bodySmall" }}
            color={colors.onSurfaceVariant}
          >
            {hint}
          </Text>
        ) : null}
      </Column>
      {children}
    </Row>
  );
};

/** Round colour swatch; shows a check when selected and an optional icon otherwise. */
const Swatch = ({
  color,
  selected,
  icon,
  onClick,
}: {
  color: string;
  selected: boolean;
  icon?: number;
  onClick: () => void;
}) => {
  const colors = useAppColors();
  const shown = selected ? Check : icon;
  return (
    <Box
      contentAlignment="center"
      modifiers={[
        size(40, 40),
        clip(Shapes.Circle),
        background(color),
        clickable(onClick),
      ]}
    >
      {shown ? (
        <Icon
          source={shown}
          size={20}
          tint={selected && !icon ? readableOn(color) : colors.onSurface}
        />
      ) : null}
    </Box>
  );
};

export default function SettingsScreen() {
  // Page scrolling pauses while a tile is dragged, so the two don't fight.
  const [dragging, setDragging] = useState(false);
  const hideOnScroll = useHideOnScroll(!dragging);
  const colors = useAppColors();
  const { user } = useAuth();
  const { settings, update, reset } = useSettings();
  const classic = settings.navStyle === "classic";
  const quickActions = useQuickActions();
  const navItems = useNavItems();
  const who = `Khusus akun ${user?.fullname.split(" ")[0] ?? "ini"}`;
  const [customOpen, setCustomOpen] = useState(false);
  const [hue, setHue] = useState(210);
  // undefined = loading, null = push notifications not set up on this phone
  const [muted, setMuted] = useState<NotificationType[] | null | undefined>();

  useEffect(() => {
    if (user) getMutedTypes(user.id).then(setMuted, () => setMuted(null));
  }, [user]);

  const { seedColor } = settings;
  const isPreset = COLOR_PRESETS.some((p) => p.hex === seedColor);
  const customHex = hueToHex(hue);

  const toggleType = async (type: NotificationType, on: boolean) => {
    if (!user || !muted) return;
    const prev = muted;
    const next = on ? prev.filter((t) => t !== type) : [...prev, type];
    setMuted(next);
    try {
      await setMutedTypes(user.id, next);
    } catch (err: any) {
      setMuted(prev);
      alert(err.message);
    }
  };

  const confirmReset = () =>
    Alert.alert(
      "Kembalikan ke default?",
      "Semua pengaturan akan dikembalikan seperti awal.",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            reset();
            if (user && muted) {
              try {
                await setMutedTypes(user.id, []);
                setMuted([]);
              } catch (err: any) {
                alert(err.message);
              }
            }
          },
        },
      ],
    );

  return (
    <AppHost style={{ flex: 1 }}>
      <Column
        verticalArrangement={{ spacedBy: 16 }}
        modifiers={[
          fillMaxSize(),
          background(colors.background),
          hideOnScroll,
          padding(16, 56, 16, 120),
        ]}
      >
        <Row
          verticalAlignment="center"
          horizontalArrangement={{ spacedBy: 4 }}
          modifiers={[fillMaxWidth()]}
        >
          <BackButton />
          <Text
            style={{ typography: "headlineMedium", fontWeight: "bold" }}
            color={colors.onBackground}
          >
            Pengaturan
          </Text>
        </Row>

        <SettingsCard title="Tampilan" subtitle="Berlaku di HP ini">
          <Segmented
            options={THEME_MODES}
            value={settings.themeMode}
            onChange={(themeMode) => update({ themeMode })}
          />
          <CardLabel>Warna tema</CardLabel>
          <FlowRow
            horizontalArrangement={{ spacedBy: 12 }}
            verticalArrangement={{ spacedBy: 12 }}
          >
            <Swatch
              color={colors.surfaceContainerHighest}
              icon={PhotoLibrary}
              selected={seedColor === null}
              onClick={() => update({ seedColor: null })}
            />
            {COLOR_PRESETS.map((p) => (
              <Swatch
                key={p.hex}
                color={p.hex}
                selected={seedColor === p.hex}
                onClick={() => update({ seedColor: p.hex })}
              />
            ))}
            <Swatch
              color={
                seedColor && !isPreset
                  ? seedColor
                  : colors.surfaceContainerHighest
              }
              icon={Add}
              selected={!!seedColor && !isPreset}
              onClick={() => setCustomOpen(true)}
            />
          </FlowRow>
          <Text
            style={{ typography: "bodySmall" }}
            color={colors.onSurfaceVariant}
          >
            {seedColor === null
              ? "Mengikuti wallpaper HP."
              : "Warna kustom dengan tombol plus."}
          </Text>
          <CardLabel>Ukuran teks</CardLabel>
          <Segmented
            options={TEXT_SCALES.map(
              (s, i) => [s, SCALE_LABELS[i]] as [number, string],
            )}
            value={settings.textScale}
            onChange={(textScale) => update({ textScale })}
            enabled={textScaleSupported}
          />
          <Text style={{ typography: "bodyMedium" }} color={colors.onSurface}>
            {textScaleSupported
              ? "Tagihan bulan ini Rp 250.000, jatuh tempo tanggal 5."
              : "Perlu update aplikasi untuk mengubah ukuran teks."}
          </Text>
        </SettingsCard>

        <ActionPicker
          title="Menu Beranda"
          subtitle={who}
          onDraggingChange={setDragging}
          {...quickActions}
        />

        <ActionPicker
          title="Navbar"
          subtitle={who}
          fixedFirst
          onDraggingChange={setDragging}
          {...navItems}
        >
          <CardLabel>Gaya</CardLabel>
          <Segmented
            options={NAV_STYLES}
            value={settings.navStyle}
            onChange={(navStyle) => update({ navStyle })}
          />
          {classic ? (
            <Text
              style={{ typography: "bodySmall" }}
              color={colors.onSurfaceVariant}
            >
              Gaya Klasik selalu berlabel, selalu tampil, dan hanya ada di
              halaman navbar, jadi pilihan di bawah tidak berlaku.
            </Text>
          ) : (
            <>
              <CardLabel>Label</CardLabel>
              <Segmented
                options={NAV_LABELS}
                value={settings.navLabels}
                onChange={(navLabels) => update({ navLabels })}
              />
            </>
          )}
          {/* With Klasik the switches show what the classic bar does and are locked. */}
          <SettingRow
            label="Sembunyikan saat scroll"
            hint="Navbar turun saat kamu scroll ke bawah dan muncul lagi saat scroll ke atas."
          >
            <Switch
              value={classic ? false : settings.hideNavOnScroll}
              enabled={!classic}
              onCheckedChange={(hideNavOnScroll) => update({ hideNavOnScroll })}
            />
          </SettingRow>
          <SettingRow
            label="Tampilkan di semua halaman"
            hint="Navbar juga muncul di Acara, Profil, dan halaman lain."
          >
            <Switch
              value={classic ? false : settings.navOnAllPages}
              enabled={!classic}
              onCheckedChange={(navOnAllPages) => update({ navOnAllPages })}
            />
          </SettingRow>
        </ActionPicker>

        <SettingsCard title="Notifikasi" subtitle="Pilih notifikasi yang mau kamu terima">
          {muted === null ? (
            <Text
              style={{ typography: "bodyMedium" }}
              color={colors.onSurfaceVariant}
            >
              Notifikasi belum aktif di HP ini.
            </Text>
          ) : (
            (Object.keys(NOTIFICATION_TYPES) as NotificationType[]).map(
              (type) => (
                <SettingRow key={type} label={NOTIFICATION_TYPES[type]}>
                  <Switch
                    enabled={!!muted}
                    value={!!muted && !muted.includes(type)}
                    onCheckedChange={(on) => toggleType(type, on)}
                  />
                </SettingRow>
              ),
            )
          )}
        </SettingsCard>

        <SettingsCard title="Reset" subtitle="Kembalikan semua pengaturan seperti awal">
          <OutlinedButton onClick={confirmReset} modifiers={[fillMaxWidth()]}>
            <Text style={{ typography: "labelLarge" }} color={colors.error}>
              Kembalikan ke default
            </Text>
          </OutlinedButton>
        </SettingsCard>
      </Column>

      {customOpen ? (
        <FormSheet
          title="Warna kustom"
          subtitle="Geser untuk memilih warna tema."
          onClose={() => setCustomOpen(false)}
        >
          <Row horizontalArrangement="center" modifiers={[fillMaxWidth()]}>
            <Box
              modifiers={[
                size(64, 64),
                clip(Shapes.Circle),
                background(customHex),
              ]}
            />
          </Row>
          <Slider
            value={hue}
            min={0}
            max={360}
            onValueChange={setHue}
            modifiers={[fillMaxWidth()]}
          />
          <SheetActions
            onCancel={() => setCustomOpen(false)}
            submitLabel="Pakai"
            onSubmit={() => {
              update({ seedColor: customHex });
              setCustomOpen(false);
            }}
          />
        </FormSheet>
      ) : null}
    </AppHost>
  );
}
