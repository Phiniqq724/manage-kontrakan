import { useAppColors } from "@/components/AppHost";
import { DraggableTiles } from "@/components/DraggableTiles";
import { QuickActionTile } from "@/components/QuickActions";
import { SettingsCard } from "@/components/SettingsCard";
import type { QuickActionKey } from "@/utils/settings";
import Home from "@expo/material-symbols/home.xml";
import { Text } from "@expo/ui/jetpack-compose";
import type { ReactNode } from "react";

/**
 * Interactive picker for a per-account list of pages (the hooks' `keys,
 * available, limit, set`): one grid with the pinned pages in a highlighted
 * zone on top and the rest below. Drag between them, or tap a page below to
 * add it and the corner button to remove one. `fixedFirst` locks a Beranda
 * tile in the first cell (not part of `keys` or `limit`). `preview` renders
 * above the grid, `children` below it.
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
  preview,
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
  preview?: ReactNode;
  children?: ReactNode;
}) => {
  const colors = useAppColors();
  const full = keys.length >= limit;
  // The locked Beranda tile counts too, e.g. 5/5 for a full navbar.
  const zoneSize = limit + (fixedFirst ? 1 : 0);
  const shownCount = keys.length + (fixedFirst ? 1 : 0);

  return (
    <SettingsCard
      title={title}
      subtitle={subtitle}
      trailing={
        <Text
          style={{ typography: "labelLarge", fontWeight: "bold" }}
          color={colors.primary}
        >
          {`${shownCount}/${zoneSize}`}
        </Text>
      }
    >
      {preview}
      <DraggableTiles<QuickActionKey | "home">
        pinned={keys}
        available={available}
        zoneSize={zoneSize}
        // A navbar of 5 gets 5 columns so the zone stays one row.
        columns={zoneSize === 5 ? 5 : 4}
        locked={fixedFirst ? "home" : undefined}
        onDraggingChange={onDraggingChange}
        onChange={(next) =>
          set(next.filter((k): k is QuickActionKey => k !== "home"))
        }
        tile={(key, inZone) =>
          key === "home" ? (
            <QuickActionTile icon={Home} label="Beranda" reserveRemove onClick={() => {}} />
          ) : inZone ? (
            <QuickActionTile
              actionKey={key}
              onClick={() => {}}
              onRemove={() => set(keys.filter((k) => k !== key))}
            />
          ) : (
            <QuickActionTile
              actionKey={key}
              reserveRemove
              dimmed={full}
              onClick={() => !full && set([...keys, key])}
            />
          )
        }
      />
      <Text style={{ typography: "bodySmall" }} color={colors.onSurfaceVariant}>
        {full
          ? "Penuh. Geser ke atas untuk mengganti, x untuk menghapus."
          : "Tahan lalu geser ke kotak atas, atau ketuk untuk menambah."}
      </Text>
      {children}
    </SettingsCard>
  );
};
