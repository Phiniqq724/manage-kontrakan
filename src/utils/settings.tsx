import "expo-sqlite/localStorage/install";
import { useAuth } from "./auth-context";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeMode = "system" | "light" | "dark";

/** Shortcuts that can be pinned to Beranda's quick actions. Admin tools are admin-only. */
export const QUICK_ACTIONS = {
  members: { label: "Penghuni", href: "/members" },
  events: { label: "Acara", href: "/events" },
  requests: { label: "Request", href: "/requests" },
  receipts: { label: "Kwitansi", href: "/receipts" },
  piket: { label: "Piket", href: "/piket" },
  rules: { label: "Aturan", href: "/rules" },
  guests: { label: "Tamu", href: "/guests" },
  profile: { label: "Profil", href: "/profile" },
  adminPayments: { label: "Pembayaran", href: "/admin/payments", adminOnly: true },
  adminRules: { label: "Usulan aturan", href: "/admin/rules", adminOnly: true },
  adminReports: { label: "Laporan", href: "/admin/reports", adminOnly: true },
  adminKamar: { label: "Kamar", href: "/admin/kamar", adminOnly: true },
} as const;
export type QuickActionKey = keyof typeof QUICK_ACTIONS;

const isAdminOnly = (key: QuickActionKey) => "adminOnly" in QUICK_ACTIONS[key];

/** How many quick actions fit: one row of 4 for members, two rows for the admin. */
export const quickActionLimit = (isAdmin: boolean) => (isAdmin ? 8 : 4);

const DEFAULT_QUICK_ACTIONS: Record<"admin" | "member", QuickActionKey[]> = {
  member: ["members", "events", "requests", "receipts"],
  admin: ["adminPayments", "adminRules", "adminReports", "adminKamar", "members"],
};

/**
 * The quick actions to show for a role: the saved choice (or the role's
 * defaults when nothing was chosen), without admin tools for non-admins,
 * capped at the role's limit.
 */
export function resolveQuickActions(
  saved: QuickActionKey[] | null,
  isAdmin: boolean,
): QuickActionKey[] {
  const base = saved ?? DEFAULT_QUICK_ACTIONS[isAdmin ? "admin" : "member"];
  return base
    .filter((k) => isAdmin || !isAdminOnly(k))
    .slice(0, quickActionLimit(isAdmin));
}

/** Navbar: 4 items in total, Beranda fixed first plus up to 3 chosen per account. */
export const NAV_ITEM_LIMIT = 3;
const DEFAULT_NAV_ITEMS: QuickActionKey[] = ["piket", "guests", "rules"];

/**
 * The navbar items after Beranda for a role: the saved choice (or the
 * default Piket, Tamu, Aturan), without admin tools for non-admins, max 3.
 */
export function resolveNavItems(
  saved: QuickActionKey[] | null,
  isAdmin: boolean,
): QuickActionKey[] {
  return (saved ?? DEFAULT_NAV_ITEMS)
    .filter((k) => isAdmin || !isAdminOnly(k))
    .slice(0, NAV_ITEM_LIMIT);
}

/** Floating navbar labels; the classic bar always labels every item. */
export type NavLabels = "active" | "none";
export type NavStyle = "floating" | "classic";

/**
 * Preset theme colours: Google's four brand colours plus Material Purple
 * (the Material 3 baseline), Teal, Orange and Pink. Each one seeds a full
 * Material You palette, like picking a colour in Android's Wallpaper & style.
 */
export const COLOR_PRESETS = [
  { name: "Biru", hex: "#4285F4" },
  { name: "Merah", hex: "#EA4335" },
  { name: "Kuning", hex: "#FBBC04" },
  { name: "Hijau", hex: "#34A853" },
  { name: "Ungu", hex: "#6750A4" },
  { name: "Teal", hex: "#00897B" },
  { name: "Oranye", hex: "#F57C00" },
  { name: "Pink", hex: "#D81B60" },
] as const;

/** App text size steps, as a multiplier of the phone's own font size. */
export const TEXT_SCALES = [0.85, 1, 1.15, 1.3] as const;

export type Settings = {
  themeMode: ThemeMode;
  /** Hex colour the Material palette is built from; null follows the wallpaper. */
  seedColor: string | null;
  textScale: number;
  /**
   * Quick actions chosen per account (keyed by user id), in order. An account
   * without an entry gets its role's defaults. Per account so a shared phone
   * (Ganti akun) keeps each person's own menu.
   */
  quickActionsByUser: Record<string, QuickActionKey[]>;
  /** Navbar items after Beranda, per account like quick actions. */
  navItemsByUser: Record<string, QuickActionKey[]>;
  /** Which navbar items show their name. */
  navLabels: NavLabels;
  /** Floating pill or classic full-width bar. */
  navStyle: NavStyle;
  hideNavOnScroll: boolean;
  /** Show the navbar on non-tab pages too (Acara, Profil, ...). */
  navOnAllPages: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  themeMode: "system",
  seedColor: null,
  textScale: 1,
  quickActionsByUser: {},
  navItemsByUser: {},
  navLabels: "active",
  navStyle: "floating",
  hideNavOnScroll: true,
  navOnAllPages: true,
};

const STORAGE_KEY = "semanggi.settings";

/**
 * Reads saved settings, keeping only known, valid values so an old or
 * corrupted save can never break the app (anything odd falls back to default).
 */
export function loadSettings(raw: string | null): Settings {
  let saved: Partial<Settings> = {};
  try {
    saved = raw ? JSON.parse(raw) : {};
  } catch {
    return DEFAULT_SETTINGS;
  }
  const d = DEFAULT_SETTINGS;
  const cleanKeys = (keys: unknown): QuickActionKey[] =>
    Array.isArray(keys)
      ? [...new Set(keys.filter((k): k is QuickActionKey => k in QUICK_ACTIONS))].slice(
          0,
          quickActionLimit(true),
        )
      : [];
  /** Per-account lists: keep only arrays, each cleaned. */
  const byUser = (value: unknown, limit: number): Record<string, QuickActionKey[]> =>
    value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value)
            .filter(([, keys]) => Array.isArray(keys))
            .map(([id, keys]) => [id, cleanKeys(keys).slice(0, limit)]),
        )
      : {};
  return {
    themeMode: ["system", "light", "dark"].includes(saved.themeMode as string)
      ? (saved.themeMode as ThemeMode)
      : d.themeMode,
    seedColor:
      typeof saved.seedColor === "string" && /^#[0-9a-f]{6}$/i.test(saved.seedColor)
        ? saved.seedColor
        : null,
    textScale: TEXT_SCALES.includes(saved.textScale as never)
      ? (saved.textScale as number)
      : d.textScale,
    quickActionsByUser: byUser(saved.quickActionsByUser, quickActionLimit(true)),
    navItemsByUser: byUser(saved.navItemsByUser, NAV_ITEM_LIMIT),
    navLabels: ["active", "none"].includes(saved.navLabels as string)
      ? (saved.navLabels as NavLabels)
      : d.navLabels,
    navStyle: ["floating", "classic"].includes(saved.navStyle as string)
      ? (saved.navStyle as NavStyle)
      : d.navStyle,
    hideNavOnScroll:
      typeof saved.hideNavOnScroll === "boolean" ? saved.hideNavOnScroll : d.hideNavOnScroll,
    navOnAllPages:
      typeof saved.navOnAllPages === "boolean" ? saved.navOnAllPages : d.navOnAllPages,
  };
}

type SettingsContextValue = {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
};

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  update: () => {},
  reset: () => {},
});

const read = () => {
  try {
    return loadSettings(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_SETTINGS;
  }
};

const write = (settings: Settings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable: settings still apply for this session.
  }
};

/** Per-device app settings, saved on this phone. */
export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState(read);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = loadSettings(JSON.stringify({ ...prev, ...patch }));
      write(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    write(DEFAULT_SETTINGS);
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const value = useMemo(() => ({ settings, update, reset }), [settings, update, reset]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => useContext(SettingsContext);

/**
 * A per-account shortcut list for the signed-in user: what to show, what can
 * be picked (admin tools only for the admin), the limit, and a setter that
 * saves for this account only.
 */
const usePerAccountList = (
  field: "quickActionsByUser" | "navItemsByUser",
  resolve: (saved: QuickActionKey[] | null, isAdmin: boolean) => QuickActionKey[],
  limit: (isAdmin: boolean) => number,
) => {
  const { settings, update } = useSettings();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const userId = user?.id ?? "";
  return {
    keys: resolve(settings[field][userId] ?? null, isAdmin),
    available: (Object.keys(QUICK_ACTIONS) as QuickActionKey[]).filter(
      (k) => isAdmin || !isAdminOnly(k),
    ),
    limit: limit(isAdmin),
    set: (keys: QuickActionKey[]) =>
      update({ [field]: { ...settings[field], [userId]: keys } }),
  };
};

/** This account's Beranda quick actions. */
export const useQuickActions = () =>
  usePerAccountList("quickActionsByUser", resolveQuickActions, quickActionLimit);

/** This account's navbar items after Beranda. */
export const useNavItems = () =>
  usePerAccountList("navItemsByUser", resolveNavItems, () => NAV_ITEM_LIMIT);
