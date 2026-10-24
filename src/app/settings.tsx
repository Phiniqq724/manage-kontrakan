import { AppHost, useAppColors } from "@/components/AppHost";
import { NavBarView, navItemsFor } from "@/components/AppTabBar";
import { BackButton } from "@/components/BackButton";
import { useSheetContentWidth } from "@/components/CameraSlot";
import { ColorWheel } from "@/components/ColorWheel";
import { FormField } from "@/components/FormField";
import { FormSheet, SheetActions } from "@/components/FormSheet";
import { useAuth } from "@/utils/auth-context";
import { hexToHsv, hsvToHex, readableOn, type Hsv } from "@/utils/color";
import { seedTextField } from "@/utils/seed-text-field";
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
import Search from "@expo/material-symbols/search.xml";
import {
  Box,
  DockedSearchBar,
  RNHostView,
  type TextFieldRef,
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
import { haptics, setHapticsEnabled } from "@/utils/haptics";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
        onClick={() => {
          if (v !== value) haptics.tick();
          onChange(v);
        }}
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
  const [hsv, setHsv] = useState<Hsv>({ h: 210, s: 0.7, v: 0.9 });
  const hexRef = useRef<TextFieldRef>(null);
  // Latest pick, for syncing the hex field when a drag ends.
  const hsvRef = useRef(hsv);
  hsvRef.current = hsv;
  const syncHex = () => seedTextField(hexRef, hsvToHex(hsvRef.current).toUpperCase());
  const wheelSize = Math.min(useSheetContentWidth(), 280);
  const [query, setQuery] = useState("");
  // undefined = loading, null = push notifications not set up on this phone
  const [muted, setMuted] = useState<NotificationType[] | null | undefined>();

  // Fill the hex field once the sheet is up.
  useEffect(() => {
    if (customOpen) syncHex();
  }, [customOpen]);

  useEffect(() => {
    if (user) getMutedTypes(user.id).then(setMuted, () => setMuted(null));
  }, [user]);

  const { seedColor } = settings;
  const isPreset = COLOR_PRESETS.some((p) => p.hex === seedColor);
  const customHex = hsvToHex(hsv);

  const openCustom = () => {
    const start = (seedColor && hexToHsv(seedColor)) || {
      h: 210,
      s: 0.7,
      v: 0.9,
    };
    setHsv(start);
    setCustomOpen(true);
  };

  // Search: a card shows when its title or any of its rows match; when only
  // some rows match, only those rows show.
  const q = query.trim().toLowerCase();
  const hit = (...words: string[]) =>
    !q || words.some((w) => w.toLowerCase().includes(q));
  const section = (title: string, rows: Record<string, string[]>) => {
    const all = hit(title);
    const row = (key: string) => all || hit(...rows[key]);
    return { show: all || Object.keys(rows).some(row), row };
  };
  const look = section("Tampilan", {
    theme: ["Tema", "Mode", "Gelap", "Terang", "Sistem"],
    color: ["Warna tema", "Warna kustom", "Wallpaper"],
    text: ["Ukuran teks", "Huruf"],
    haptics: ["Getar", "Getaran"],
  });
  const home = section("Menu Beranda", { tiles: ["Pintasan", "Menu"] });
  const nav = section("Navbar", {
    tiles: ["Menu navbar"],
    style: ["Gaya", "Melayang", "Klasik"],
    labels: ["Label", "Aktif saja", "Tanpa label"],
    hide: ["Sembunyikan saat scroll"],
    allPages: ["Tampilkan di semua halaman"],
  });
  const notif = section(
    "Notifikasi",
    Object.fromEntries(
      Object.entries(NOTIFICATION_TYPES).map(([k, label]) => [k, [label]]),
    ),
  );
  const resetSection = section("Reset", { reset: ["Kembalikan ke default"] });
  const nothing = ![look, home, nav, notif, resetSection].some((x) => x.show);

  const toggleType = async (type: NotificationType, on: boolean) => {
    if (!user || !muted) return;
    const prev = muted;
    const next = on ? prev.filter((t) => t !== type) : [...prev, type];
    setMuted(next);
    try {
      await setMutedTypes(user.id, next);
    } catch (err: any) {
      setMuted(prev);
      haptics.error();
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
                haptics.error();
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

        <DockedSearchBar onQueryChange={setQuery} modifiers={[fillMaxWidth()]}>
          <DockedSearchBar.Placeholder>
            <Text>Cari pengaturan</Text>
          </DockedSearchBar.Placeholder>
          <DockedSearchBar.LeadingIcon>
            <Icon source={Search} tint={colors.onSurfaceVariant} size={20} />
          </DockedSearchBar.LeadingIcon>
        </DockedSearchBar>

        {nothing ? (
          <Text
            style={{ typography: "bodyMedium" }}
            color={colors.onSurfaceVariant}
          >
            Tidak ada yang cocok.
          </Text>
        ) : null}

        {look.show ? (
          <SettingsCard title="Tampilan" subtitle="Berlaku di HP ini">
            {look.row("theme") ? (
              <Segmented
                options={THEME_MODES}
                value={settings.themeMode}
                onChange={(themeMode) => update({ themeMode })}
              />
            ) : null}
            {look.row("color") ? (
              <>
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
                    onClick={openCustom}
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
              </>
            ) : null}
            {look.row("text") ? (
              <>
                <CardLabel>Ukuran teks</CardLabel>
                <Segmented
                  options={TEXT_SCALES.map(
                    (s, i) => [s, SCALE_LABELS[i]] as [number, string],
                  )}
                  value={settings.textScale}
                  onChange={(textScale) => update({ textScale })}
                  enabled={textScaleSupported}
                />
                <Text
                  style={{ typography: "bodyMedium" }}
                  color={colors.onSurface}
                >
                  {textScaleSupported
                    ? "Tagihan bulan ini Rp 250.000, jatuh tempo tanggal 5."
                    : "Perlu update aplikasi untuk mengubah ukuran teks."}
                </Text>
              </>
            ) : null}
            {look.row("haptics") ? (
              <SettingRow label="Getar">
                <Switch
                  value={settings.haptics}
                  onCheckedChange={(on) => {
                    // Buzz on the way on; off stays silent.
                    setHapticsEnabled(on);
                    haptics.toggle(true);
                    update({ haptics: on });
                  }}
                />
              </SettingRow>
            ) : null}
          </SettingsCard>
        ) : null}

        {home.show ? (
          <ActionPicker
            title="Menu Beranda"
            subtitle={who}
            onDraggingChange={setDragging}
            {...quickActions}
          />
        ) : null}

        {nav.show ? (
          <ActionPicker
            title="Navbar"
            subtitle={who}
            fixedFirst
            onDraggingChange={setDragging}
            preview={
              // The real bar with Beranda as the open page.
              <Box
                contentAlignment="center"
                modifiers={[
                  fillMaxWidth(),
                  clip(Shapes.RoundedCorner(16)),
                  background(colors.background),
                  padding(0, classic ? 0 : 8, 0, classic ? 0 : 8),
                ]}
              >
                <NavBarView
                  items={navItemsFor(navItems.keys)}
                  activeKey="dashboard"
                  classic={classic}
                  labels={settings.navLabels}
                />
              </Box>
            }
            {...navItems}
          >
            {nav.row("style") ? (
              <>
                <CardLabel>Gaya</CardLabel>
                <Segmented
                  options={NAV_STYLES}
                  value={settings.navStyle}
                  onChange={(navStyle) => update({ navStyle })}
                />
              </>
            ) : null}
            {classic ? (
              <Text
                style={{ typography: "bodySmall" }}
                color={colors.onSurfaceVariant}
              >
                Klasik selalu berlabel dan hanya ada di halaman navbar.
              </Text>
            ) : nav.row("labels") ? (
              <>
                <CardLabel>Label</CardLabel>
                <Segmented
                  options={NAV_LABELS}
                  value={settings.navLabels}
                  onChange={(navLabels) => update({ navLabels })}
                />
              </>
            ) : null}
            {/* With Klasik the switches show what the classic bar does and are locked. */}
            {nav.row("hide") ? (
              <SettingRow
                label="Sembunyikan saat scroll"
                hint="Navbar turun saat kamu scroll ke bawah dan muncul lagi saat scroll ke atas."
              >
                <Switch
                  value={classic ? false : settings.hideNavOnScroll}
                  enabled={!classic}
                  onCheckedChange={(hideNavOnScroll) => {
                    haptics.toggle(hideNavOnScroll);
                    update({ hideNavOnScroll });
                  }}
                />
              </SettingRow>
            ) : null}
            {nav.row("allPages") ? (
              <SettingRow
                label="Tampilkan di semua halaman"
                hint="Navbar juga muncul di Acara, Profil, dan halaman lain."
              >
                <Switch
                  value={classic ? false : settings.navOnAllPages}
                  enabled={!classic}
                  onCheckedChange={(navOnAllPages) => {
                    haptics.toggle(navOnAllPages);
                    update({ navOnAllPages });
                  }}
                />
              </SettingRow>
            ) : null}
          </ActionPicker>
        ) : null}

        {notif.show ? (
          <SettingsCard
            title="Notifikasi"
            subtitle="Pilih notifikasi yang mau kamu terima"
          >
            {muted === null ? (
              <Text
                style={{ typography: "bodyMedium" }}
                color={colors.onSurfaceVariant}
              >
                Notifikasi belum aktif di HP ini.
              </Text>
            ) : (
              (Object.keys(NOTIFICATION_TYPES) as NotificationType[])
                .filter(notif.row)
                .map((type) => (
                  <SettingRow key={type} label={NOTIFICATION_TYPES[type]}>
                    <Switch
                      enabled={!!muted}
                      value={!!muted && !muted.includes(type)}
                      onCheckedChange={(on) => {
                        haptics.toggle(on);
                        toggleType(type, on);
                      }}
                    />
                  </SettingRow>
                ))
            )}
          </SettingsCard>
        ) : null}

        {resetSection.show ? (
          <SettingsCard
            title="Reset"
            subtitle="Kembalikan semua pengaturan seperti awal"
          >
            <OutlinedButton onClick={confirmReset} modifiers={[fillMaxWidth()]}>
              <Text style={{ typography: "labelLarge" }} color={colors.error}>
                Kembalikan ke default
              </Text>
            </OutlinedButton>
          </SettingsCard>
        ) : null}
      </Column>

      {customOpen ? (
        <FormSheet
          title="Warna kustom"
          skipPartial
          onClose={() => setCustomOpen(false)}
        >
          <Row horizontalArrangement="center" modifiers={[fillMaxWidth()]}>
            <RNHostView matchContents>
              <ColorWheel
                size={wheelSize}
                value={hsv}
                onChange={(next) => {
                  // A tick every 30 degrees of hue.
                  if (Math.floor(next.h / 30) !== Math.floor(hsv.h / 30))
                    haptics.step();
                  setHsv(next);
                }}
                onRelease={syncHex}
              />
            </RNHostView>
          </Row>
          <Row
            verticalAlignment="center"
            horizontalArrangement={{ spacedBy: 12 }}
            modifiers={[fillMaxWidth()]}
          >
            <Text
              style={{ typography: "labelMedium" }}
              color={colors.onSurfaceVariant}
            >
              Gelap
            </Text>
            <Slider
              value={hsv.v}
              min={0}
              max={1}
              onValueChange={(v) => {
                if (Math.floor(v * 10) !== Math.floor(hsv.v * 10))
                  haptics.step();
                setHsv((cur) => ({ ...cur, v }));
              }}
              onValueChangeFinished={syncHex}
              modifiers={[weight(1)]}
            />
            <Text
              style={{ typography: "labelMedium" }}
              color={colors.onSurfaceVariant}
            >
              Terang
            </Text>
          </Row>
          <Row
            verticalAlignment="center"
            horizontalArrangement={{ spacedBy: 12 }}
            modifiers={[fillMaxWidth()]}
          >
            <Box
              modifiers={[
                size(48, 48),
                clip(Shapes.Circle),
                background(customHex),
              ]}
            />
            <Box modifiers={[weight(1)]}>
              <FormField
                label="Kode warna"
                ref={hexRef}
                singleLine
                keyboardOptions={{ capitalization: "characters" }}
                onValueChange={(text) => {
                  const next = hexToHsv(text);
                  if (next && hsvToHex(next) !== customHex) setHsv(next);
                }}
              />
            </Box>
          </Row>
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
