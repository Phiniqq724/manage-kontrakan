import { AppHost, useAppColors } from "@/components/AppHost";
import { isSlot, pinnedAfterDrop, zoneLayout } from "@/utils/drag-zone";
import { haptics } from "@/utils/haptics";
import { RNHostView } from "@expo/ui/jetpack-compose";
import { useRef, useState, type ReactNode } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Sortable from "react-native-sortables";

const ROW_GAP = 20;
/** Holding still this long locks the page, safely before the drag starts (250ms). */
const HOLD_LOCK_MS = 150;
/** Moving further than this before then is a page scroll, not a hold. */
const MOVE_SLOP = 8;
/** How far the zone's background reaches past its tiles. */
const ZONE_PAD = 8;

/**
 * One draggable grid holding a pinned zone (highlighted top rows, padded with
 * outlined empty slots) and the remaining items below it. Hold and drag to
 * reorder, drag up into the zone to pin, drag down out of it to unpin. The
 * zone never grows: dropping into a full zone pushes its last item out.
 * `locked` stays in the first cell and can't be dragged.
 * Built with react-native-sortables, hosted inside the Compose page; each
 * tile is drawn by `tile` in its own small Compose host.
 */
export const DraggableTiles = <K extends string>({
  pinned,
  available,
  zoneSize,
  columns,
  locked,
  tile,
  onChange,
  onDraggingChange,
}: {
  pinned: K[];
  available: K[];
  /** Cells in the zone, the locked tile included. */
  zoneSize: number;
  columns: number;
  locked?: K;
  tile: (key: K, inZone: boolean) => ReactNode;
  onChange: (pinned: K[]) => void;
  /** True while a tile is being dragged, so the page can stop scrolling. */
  onDraggingChange?: (dragging: boolean) => void;
}) => {
  const colors = useAppColors();
  const [rowHeight, setRowHeight] = useState(0);
  // Bumped when a drop had to be corrected (e.g. a page that only slid into
  // the zone goes back down), so the grid redraws from the real order.
  const [epoch, setEpoch] = useState(0);
  // Locking the page only once the drag starts was too late: the page had
  // already begun scrolling under the finger. A still hold locks it first.
  const hold = useRef<{ x: number; y: number; timer?: ReturnType<typeof setTimeout> } | null>(null);
  // The drag can cancel the plain touch events; only its own end unlocks then.
  const dragActive = useRef(false);
  const endHold = () => {
    if (hold.current?.timer) clearTimeout(hold.current.timer);
    hold.current = null;
  };
  const data = zoneLayout(pinned, available, zoneSize, locked);
  const zoneRows = Math.ceil(zoneSize / columns);
  const zoneHeight = zoneRows * rowHeight + (zoneRows - 1) * ROW_GAP + ZONE_PAD * 2;

  return (
    <RNHostView matchContents={{ vertical: true }}>
      <GestureHandlerRootView
        style={{ paddingTop: ZONE_PAD }}
        onTouchStart={(e) => {
          endHold();
          const { pageX: x, pageY: y } = e.nativeEvent;
          hold.current = {
            x,
            y,
            timer: setTimeout(() => onDraggingChange?.(true), HOLD_LOCK_MS),
          };
        }}
        onTouchMove={(e) => {
          const h = hold.current;
          if (!h?.timer) return;
          const { pageX, pageY } = e.nativeEvent;
          if (Math.hypot(pageX - h.x, pageY - h.y) > MOVE_SLOP) {
            clearTimeout(h.timer);
            h.timer = undefined;
          }
        }}
        onTouchEnd={() => {
          endHold();
          if (!dragActive.current) onDraggingChange?.(false);
        }}
        onTouchCancel={() => {
          endHold();
          if (!dragActive.current) onDraggingChange?.(false);
        }}
      >
        {rowHeight > 0 ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: zoneHeight,
              borderRadius: 20,
              backgroundColor: colors.surfaceContainerHighest,
            }}
          />
        ) : null}
        <Sortable.Grid
          key={`${columns}-${epoch}`}
          columns={columns}
          rowGap={ROW_GAP}
          data={data}
          keyExtractor={(k) => k}
          customHandle
          overflow="visible"
          dragActivationDelay={250}
          renderItem={({ item }) => {
            if (isSlot(item)) {
              // Same height as a tile: rows that change height mid-drag shift
              // the whole page, which looked like it scrolling.
              return (
                <View style={{ alignItems: "center", height: rowHeight || undefined }}>
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      marginTop: 4,
                      borderRadius: 16,
                      borderWidth: 1.5,
                      borderStyle: "dashed",
                      borderColor: colors.outline,
                    }}
                  />
                </View>
              );
            }
            const key = item as K;
            const content = (
              <View
                onLayout={(e) => {
                  // Row height = the tallest tile (pinned ones carry the remove button).
                  const h = e.nativeEvent.layout.height;
                  setRowHeight((cur) => Math.max(cur, h));
                }}
                style={{ alignItems: "center" }}
              >
                <AppHost matchContents>{tile(key, pinned.includes(key) || key === locked)}</AppHost>
              </View>
            );
            return (
              <Sortable.Handle mode={key === locked ? "fixed-order" : "draggable"}>
                {content}
              </Sortable.Handle>
            );
          }}
          onDragStart={() => {
            dragActive.current = true;
            haptics.dragStart();
            onDraggingChange?.(true);
          }}
          onOrderChange={haptics.tick}
          onDragEnd={({ data: order, key }) => {
            dragActive.current = false;
            haptics.drop();
            onDraggingChange?.(false);
            const next = pinnedAfterDrop({ order, dragged: key, pinned, zoneSize, locked });
            if (zoneLayout(next, available, zoneSize, locked).join() !== order.join()) {
              setEpoch((e) => e + 1);
            }
            onChange(next);
          }}
        />
      </GestureHandlerRootView>
    </RNHostView>
  );
};
