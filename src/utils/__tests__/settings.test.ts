/// <reference types="jest" />

jest.mock("expo-sqlite/localStorage/install", () => ({}));
// settings.tsx imports the auth context for useQuickActions; not needed here.
jest.mock("@/utils/auth-context", () => ({ useAuth: () => ({ user: null }) }));

import {
  DEFAULT_SETTINGS,
  loadSettings,
  resolveNavItems,
  resolveQuickActions,
} from "@/utils/settings";

describe("loadSettings", () => {
  it("round-trips a valid save", () => {
    const saved = {
      themeMode: "dark",
      seedColor: "#4285F4",
      textScale: 1.15,
      quickActionsByUser: { "user-a": ["piket", "rules"], "user-b": [] },
      navItemsByUser: { "user-a": ["members", "events"] },
      navLabels: "none",
      navStyle: "classic",
      hideNavOnScroll: false,
      navOnAllPages: false,
    };
    expect(loadSettings(JSON.stringify(saved))).toEqual(saved);
  });

  it("falls back to defaults for null or garbage", () => {
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings("{not json")).toEqual(DEFAULT_SETTINGS);
  });

  it("cleans each account's quick actions: unknown, duplicates, max 8", () => {
    const quick = [
      "piket",
      "nope",
      "piket",
      "rules",
      "guests",
      "members",
      "events",
      "receipts",
      "requests",
      "profile",
      "adminKamar",
    ];
    expect(
      loadSettings(JSON.stringify({ quickActionsByUser: { u1: quick } }))
        .quickActionsByUser.u1,
    ).toEqual([
      "piket",
      "rules",
      "guests",
      "members",
      "events",
      "receipts",
      "requests",
      "profile",
    ]);
  });

  it("keeps accounts separate and drops malformed entries", () => {
    const s = loadSettings(
      JSON.stringify({
        quickActionsByUser: {
          admin: ["adminKamar"],
          member: ["piket"],
          broken: "x",
        },
      }),
    );
    expect(s.quickActionsByUser).toEqual({
      admin: ["adminKamar"],
      member: ["piket"],
    });
  });

  it("ignores a non-object quickActionsByUser", () => {
    expect(
      loadSettings(JSON.stringify({ quickActionsByUser: [1, 2] }))
        .quickActionsByUser,
    ).toEqual({});
  });

  it("resets invalid seedColor and textScale", () => {
    const s = loadSettings(JSON.stringify({ seedColor: "blue", textScale: 2 }));
    expect(s.seedColor).toBeNull();
    expect(s.textScale).toBe(1);
  });
});

describe("resolveQuickActions", () => {
  it("gives members and the admin their own defaults", () => {
    expect(resolveQuickActions(null, false)).toEqual([
      "members",
      "events",
      "requests",
      "receipts",
    ]);
    expect(resolveQuickActions(null, true)).toEqual([
      "adminPayments",
      "adminRules",
      "adminReports",
      "adminKamar",
      "members",
    ]);
  });

  it("hides admin tools from members", () => {
    expect(
      resolveQuickActions(["adminPayments", "piket", "adminKamar"], false),
    ).toEqual(["piket"]);
  });

  it("caps members at 4 and the admin at 8", () => {
    const eight = [
      "members",
      "events",
      "requests",
      "receipts",
      "piket",
      "rules",
      "guests",
      "profile",
    ] as const;
    expect(resolveQuickActions([...eight], false)).toHaveLength(4);
    expect(resolveQuickActions([...eight], true)).toHaveLength(8);
  });
});

describe("resolveNavItems", () => {
  it("defaults to Piket, Tamu, Aturan after Beranda", () => {
    expect(resolveNavItems(null, false)).toEqual(["piket", "guests", "rules"]);
  });

  it("allows any page, hides admin tools from members, max 3 after Beranda", () => {
    expect(resolveNavItems(["members", "adminKamar", "events"], false)).toEqual(
      ["members", "events"],
    );
    expect(
      resolveNavItems(
        ["members", "events", "requests", "receipts", "profile"],
        true,
      ),
    ).toHaveLength(3);
  });
});

describe("navbar options", () => {
  it("falls back to defaults for unknown label and style values", () => {
    const s = loadSettings(
      JSON.stringify({ navLabels: "big", navStyle: "round" }),
    );
    // "Semua" was removed; old saves fall back to "Aktif saja".
    expect(loadSettings(JSON.stringify({ navLabels: "all" })).navLabels).toBe("active");
    expect(s.navLabels).toBe("active");
    expect(s.navStyle).toBe("floating");
  });
});
