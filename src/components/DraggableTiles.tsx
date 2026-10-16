import { AppHost } from "@/components/AppHost";
import { RNHostView } from "@expo/ui/jetpack-compose";
import type { ReactNode } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Sortable from "react-native-sortables";

/**
 * A 4-column grid of tiles the user can reorder by holding and dragging.
 * Built with react-native-sortables (React Native), hosted inside the Compose
 * page; each tile is drawn by `tile` in its own small Compose host.
 * `lockedFirst` stays first and can't be dragged.
 */
export const DraggableTiles = <K extends string>({
  keys,
  tile,
  onReorder,
  lockedFirst,
  onDraggingChange,
}: {
  keys: K[];
  tile: (key: K) => ReactNode;
  onReorder: (keys: K[]) => void;
  lockedFirst?: K;
  /** True while a tile is being dragged, so the page can stop scrolling. */
  onDraggingChange?: (dragging: boolean) => void;
}) => (
  <RNHostView matchContents={{ vertical: true }}>
    <GestureHandlerRootView>
      <Sortable.Grid
        columns={4}
        rowGap={12}
        data={keys}
        keyExtractor={(k) => k}
        customHandle
        overflow="visible"
        dragActivationDelay={250}
        renderItem={({ item }) => {
          const content = (
            <View style={{ alignItems: "center" }}>
              <AppHost matchContents>{tile(item)}</AppHost>
            </View>
          );
          return item === lockedFirst ? (
            content
          ) : (
            <Sortable.Handle>{content}</Sortable.Handle>
          );
        }}
        onDragStart={() => onDraggingChange?.(true)}
        onDragEnd={({ data }) => {
          onDraggingChange?.(false);
          // Nothing may be dropped in front of the locked tile.
          onReorder(
            lockedFirst
              ? [lockedFirst, ...data.filter((k) => k !== lockedFirst)]
              : data,
          );
        }}
      />
    </GestureHandlerRootView>
  </RNHostView>
);
