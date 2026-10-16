import { useAppColors } from "@/components/AppHost";
import { DraggableTiles } from "@/components/DraggableTiles";
import { QuickActionRows, QuickActionTile } from "@/components/QuickActions";
import { CardLabel, SettingsCard } from "@/components/SettingsCard";
import type { QuickActionKey } from "@/utils/settings";
import Home from "@expo/material-symbols/home.xml";
import { Column, Text } from "@expo/ui/jetpack-compose";
import type { ReactNode } from "react";

/**
 * Interactive picker for a per-account list of pages (the hooks' `keys,
 * available, limit, set`): a live preview of the tiles. Hold and drag a
 * pinned tile to reorder; the corner button removes it. Tap an available
 * tile to add it. `fixedFirst` shows a locked Beranda tile
 * before the list (not part of `keys` or `limit`); `children` render below.
 */
export const ActionPicker = ({
  title,
  subtitle,
  keys,
  available,
  limit,
  set,
  fixedFirst = false,
  onDraggingChange,
  children,
}: {
  title: string;
  subtitle?: string;
  keys: QuickActionKey[];
  available: QuickActionKey[];
  limit: number;
  set: (keys: QuickActionKey[]) => void;
  fixedFirst?: boolean;
  /** True while a tile is dragged; the page should stop scrolling meanwhile. */
  onDraggingChange?: (dragging: boolean) => void;
  children?: ReactNode;
}) => {
  const colors = useAppColors();
  const others = available.filter((k) => !keys.includes(k));
  const full = keys.length >= limit;
  // The locked Beranda tile counts too, e.g. 4/4 for a full navbar.
  const shownCount = keys.length + (fixedFirst ? 1 : 0);
  const shownLimit = limit + (fixedFirst ? 1 : 0);

  const hint = "Tahan lalu geser untuk memindah, ketuk x untuk menghapus.";

  return (
    <SettingsCard
      title={title}
      subtitle={subtitle}
      trailing={
        <Text
          style={{ typography: "labelLarge", fontWeight: "bold" }}
          color={colors.primary}
        >
          {`${shownCount}/${shownLimit}`}
        </Text>
      }
    >
      {keys.length > 0 || fixedFirst ? (
        <DraggableTiles
          keys={fixedFirst ? ["home" as const, ...keys] : keys}
          lockedFirst={fixedFirst ? "home" : undefined}
          onDraggingChange={onDraggingChange}
          onReorder={(order) =>
            set(order.filter((k): k is QuickActionKey => k !== "home"))
          }
          tile={(key) =>
            key === "home" ? (
              <QuickActionTile icon={Home} label="Beranda" onClick={() => {}} />
            ) : (
              <QuickActionTile
                actionKey={key}
                onClick={() => {}}
                onRemove={() => set(keys.filter((k) => k !== key))}
              />
            )
          }
        />
      ) : (
        <Text
          style={{ typography: "bodyMedium" }}
          color={colors.onSurfaceVariant}
        >
          Belum ada menu. Tambahkan dari daftar di bawah.
        </Text>
      )}
      <Text style={{ typography: "bodySmall" }} color={colors.onSurfaceVariant}>
        {hint}
      </Text>

      {others.length > 0 ? (
        <Column verticalArrangement={{ spacedBy: 12 }}>
          <CardLabel>
            {full
              ? `Tersedia (maks ${shownLimit}, hapus satu dulu)`
              : "Tersedia, ketuk untuk menambah"}
          </CardLabel>
          <QuickActionRows
            keys={others}
            tile={(key) => (
              <QuickActionTile
                key={key}
                actionKey={key}
                dimmed={full}
                onClick={() => !full && set([...keys, key])}
              />
            )}
          />
        </Column>
      ) : null}
      {children}
    </SettingsCard>
  );
};
