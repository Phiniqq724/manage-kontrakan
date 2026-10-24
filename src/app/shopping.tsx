import { AppHost, useAppColors } from "@/components/AppHost";
import { ImageViewerModal } from "@/components/ImageViewerModal";
import { EmptyState, IconText } from "@/components/ListBits";
import {
  AddShoppingSheet,
  RejectShoppingSheet,
  SubmitShoppingSheet,
} from "@/components/ShoppingSheets";
import { shoppingApi, usersApi } from "@/services/api";
import { useAuth } from "@/utils/auth-context";
import { haptics } from "@/utils/haptics";
import {
  shoppingActionFor,
  splitShopping,
  timeAgo,
  type ShoppingItem,
} from "@/utils/shopping";
import { useHideOnScroll, useTabAction } from "@/utils/tab-action";
import AddShoppingCart from "@expo/material-symbols/add_shopping_cart.xml";
import Block from "@expo/material-symbols/block.xml";
import Delete from "@expo/material-symbols/delete.xml";
import DoneAll from "@expo/material-symbols/done_all.xml";
import HourglassTop from "@expo/material-symbols/hourglass_top.xml";
import ShoppingCart from "@expo/material-symbols/shopping_cart.xml";
import {
  Box,
  Button,
  Card,
  Column,
  Icon,
  IconButton,
  OutlinedButton,
  PullToRefreshBox,
  RNHostView,
  Row,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Text,
} from "@expo/ui/jetpack-compose";
import {
  background,
  clickable,
  clip,
  fillMaxSize,
  fillMaxWidth,
  padding,
  size,
  Shapes,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useEffect, useState } from "react";
import { Image } from "react-native";

const firstName = (fullname?: string) => fullname?.split(" ")[0] ?? "Seseorang";

/** Small square photo that opens full screen on tap. */
const Thumb = ({ uri, onPress }: { uri: string; onPress: () => void }) => {
  const colors = useAppColors();
  return (
    <Box
      modifiers={[
        size(64, 64),
        clip(Shapes.RoundedCorner(12)),
        background(colors.surfaceContainerHighest),
        clickable(onPress),
      ]}
    >
      <RNHostView>
        <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
      </RNHostView>
    </Box>
  );
};

export default function ShoppingScreen() {
  const hideOnScroll = useHideOnScroll();
  const { user } = useAuth();
  const colors = useAppColors();
  const muted = colors.onSurfaceVariant;

  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [segment, setSegment] = useState<"active" | "done">("active");
  const [now, setNow] = useState(new Date());
  const [addOpen, setAddOpen] = useState(false);
  const [buying, setBuying] = useState<ShoppingItem | null>(null);
  const [rejecting, setRejecting] = useState<ShoppingItem | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useTabAction("shopping", AddShoppingCart, () => setAddOpen(true));

  useEffect(() => {
    loadData();
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  async function loadData() {
    const [itemRes, userRes] = await Promise.all([shoppingApi.getAll(), usersApi.getAll()]);
    if (itemRes.data) setItems(itemRes.data);
    setNames(Object.fromEntries((userRes.data ?? []).map((u) => [u.id, u.fullname])));
  }

  const onRefresh = () => {
    haptics.refresh();
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  };

  async function handleAccept(item: ShoppingItem) {
    setBusyId(item.id);
    try {
      const { error } = await shoppingApi.review(item.id, true);
      if (error) throw error;
      haptics.success();
      loadData();
    } catch (err: any) {
      haptics.error();
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(item: ShoppingItem) {
    setBusyId(item.id);
    try {
      const { error } = await shoppingApi.delete(item.id);
      if (error) throw error;
      haptics.success();
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err: any) {
      haptics.error();
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (!user) return null;
  const isAdmin = user.role === "admin";
  const { active, done } = splitShopping(items);
  const shown = segment === "active" ? active : done;
  const who = (id: string | null) => (id === user.id ? "kamu" : firstName(names[id ?? ""]));

  /** Status line under the item name; icon + text so it never relies on colour. */
  const statusOf = (item: ShoppingItem) => {
    switch (item.status) {
      case "submitted":
        return { icon: HourglassTop, text: `Dibeli ${who(item.bought_by)} · nunggu ${who(item.created_by)}`, color: colors.tertiary };
      case "rejected":
        return { icon: Block, text: `Ditolak · ${who(item.bought_by)} upload ulang`, color: colors.error };
      case "done":
        return { icon: DoneAll, text: `Dibeli ${who(item.bought_by)}`, color: colors.primary };
      default:
        return { icon: ShoppingCart, text: "Belum dibeli", color: muted };
    }
  };

  const renderItem = (item: ShoppingItem) => {
    const action = shoppingActionFor(item, user.id);
    const status = statusOf(item);
    const canDelete = isAdmin || (item.created_by === user.id && item.status === "open");
    const busy = busyId === item.id;
    return (
      <Card
        key={item.id}
        colors={{ containerColor: colors.surfaceContainer }}
        modifiers={[fillMaxWidth()]}
      >
        <Column verticalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth(), padding(16, 14, 8, 14)]}>
          <Row verticalAlignment="top" modifiers={[fillMaxWidth()]}>
            <Column verticalArrangement={{ spacedBy: 4 }} modifiers={[weight(1)]}>
              <Text style={{ typography: "titleMedium", fontWeight: "bold" }} color={colors.onSurface}>
                {item.name}
              </Text>
              {item.note ? (
                <Text style={{ typography: "bodyMedium" }} color={colors.onSurface}>
                  {item.note}
                </Text>
              ) : null}
              <Text style={{ typography: "bodySmall" }} color={muted}>
                {`${who(item.created_by)} · ${timeAgo(item.created_at, now)}`}
              </Text>
              <IconText icon={status.icon} text={status.text} color={status.color} bold />
              {item.status === "rejected" && item.reject_note ? (
                <Text style={{ typography: "bodySmall" }} color={colors.error}>
                  {item.reject_note}
                </Text>
              ) : null}
            </Column>
            {canDelete ? (
              <IconButton enabled={!busy} onClick={() => handleDelete(item)}>
                <Icon source={Delete} tint={muted} size={22} />
              </IconButton>
            ) : null}
          </Row>

          {item.item_photo && item.receipt_photo ? (
            <Row horizontalArrangement={{ spacedBy: 8 }}>
              <Thumb uri={item.item_photo} onPress={() => setViewing(item.item_photo)} />
              <Thumb uri={item.receipt_photo} onPress={() => setViewing(item.receipt_photo)} />
            </Row>
          ) : null}

          {action === "review" ? (
            <Row horizontalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth(), padding(0, 0, 8, 0)]}>
              <OutlinedButton enabled={!busy} onClick={() => setRejecting(item)} modifiers={[weight(1)]}>
                <Text style={{ typography: "labelLarge" }} color={colors.error}>
                  Tolak
                </Text>
              </OutlinedButton>
              <Button enabled={!busy} onClick={() => handleAccept(item)} modifiers={[weight(1)]}>
                <Text style={{ typography: "labelLarge", fontWeight: "bold" }} color={colors.onPrimary}>
                  Terima
                </Text>
              </Button>
            </Row>
          ) : action ? (
            <Box modifiers={[fillMaxWidth(), padding(0, 0, 8, 0)]}>
              <Button enabled={!busy} onClick={() => setBuying(item)} modifiers={[fillMaxWidth()]}>
                <Text style={{ typography: "labelLarge", fontWeight: "bold" }} color={colors.onPrimary}>
                  {action === "resubmit" ? "Upload ulang" : "Sudah beli"}
                </Text>
              </Button>
            </Box>
          ) : null}
        </Column>
      </Card>
    );
  };

  return (
    <AppHost style={{ flex: 1 }}>
      <PullToRefreshBox
        isRefreshing={refreshing}
        onRefresh={onRefresh}
        contentAlignment="topCenter"
        modifiers={[fillMaxSize(), background(colors.background)]}
      >
        <Column
          verticalArrangement={{ spacedBy: 16 }}
          modifiers={[fillMaxSize(), hideOnScroll, padding(16, 56, 16, 120)]}
        >
          <Text style={{ typography: "headlineMedium", fontWeight: "bold" }} color={colors.onBackground}>
            Belanja
          </Text>

          <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
            {(["active", "done"] as const).map((key) => (
              <SegmentedButton
                key={key}
                selected={segment === key}
                onClick={() => {
                  if (segment !== key) haptics.tick();
                  setSegment(key);
                }}
              >
                <SegmentedButton.Label>
                  <Text>{key === "active" ? `Perlu dibeli · ${active.length}` : `Selesai · ${done.length}`}</Text>
                </SegmentedButton.Label>
              </SegmentedButton>
            ))}
          </SingleChoiceSegmentedButtonRow>

          {shown.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              text={segment === "active" ? "Semua sudah dibeli." : "Belum ada yang selesai."}
              action={segment === "active" ? "Tambah barang" : undefined}
              onAction={() => setAddOpen(true)}
            />
          ) : (
            shown.map(renderItem)
          )}
        </Column>
      </PullToRefreshBox>

      {addOpen && (
        <AddShoppingSheet
          fullname={user.fullname}
          onClose={() => setAddOpen(false)}
          onAdded={(item) => {
            setItems((prev) => [item, ...prev]);
            setSegment("active");
            setAddOpen(false);
          }}
        />
      )}

      {buying && (
        <SubmitShoppingSheet
          item={buying}
          userId={user.id}
          onClose={() => setBuying(null)}
          onSubmitted={() => {
            setBuying(null);
            loadData();
          }}
        />
      )}

      {rejecting && (
        <RejectShoppingSheet
          item={rejecting}
          onClose={() => setRejecting(null)}
          onRejected={() => {
            setRejecting(null);
            loadData();
          }}
        />
      )}

      <ImageViewerModal uri={viewing} visible={!!viewing} onClose={() => setViewing(null)} />
    </AppHost>
  );
}
