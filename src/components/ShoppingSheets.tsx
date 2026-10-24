import { useAppColors } from "@/components/AppHost";
import { CameraSlot, useSheetContentWidth } from "@/components/CameraSlot";
import { FormField } from "@/components/FormField";
import { Collapse, FormSheet, SheetActions } from "@/components/FormSheet";
import { shoppingApi } from "@/services/api";
import { haptics } from "@/utils/haptics";
import { sendPush } from "@/utils/notifications";
import type { ShoppingItem } from "@/utils/shopping";
import { uploadResizedAsset, type LocalImage } from "@/utils/upload";
import PhotoCamera from "@expo/material-symbols/photo_camera.xml";
import ReceiptLong from "@expo/material-symbols/receipt_long.xml";
import {
  AnimatedVisibility,
  EnterTransition,
  ExitTransition,
  Row,
  Spacer,
  Text,
} from "@expo/ui/jetpack-compose";
import { fillMaxWidth, width } from "@expo/ui/jetpack-compose/modifiers";
import type { ReactNode } from "react";
import { useState } from "react";

const BUCKET = "shopping-evidence";
const SLOT_HEIGHT = 200;
const ROW_GAP = 12;

/** Folds sideways, so the other photo box can grow across the row. */
const SideCollapse = ({ visible, children }: { visible: boolean; children: ReactNode }) => (
  <AnimatedVisibility
    visible={visible}
    enterTransition={EnterTransition.expandHorizontally().plus(EnterTransition.fadeIn())}
    exitTransition={ExitTransition.shrinkHorizontally().plus(ExitTransition.fadeOut())}
  >
    {children}
  </AnimatedVisibility>
);

/** New item: name plus an optional note. Everyone else is notified. */
export const AddShoppingSheet = ({
  fullname,
  onClose,
  onAdded,
}: {
  fullname: string;
  onClose: () => void;
  onAdded: (item: ShoppingItem) => void;
}) => {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const { data, error } = await shoppingApi.create(name.trim(), note.trim() || null);
      if (error) throw error;
      haptics.success();
      onAdded(data);
      sendPush({
        recipients: "all_except_me",
        type: "shopping",
        title: "Daftar belanja",
        body: `${fullname.split(" ")[0]} butuh ${data.name}.`,
      }).catch(() => {});
    } catch (err: any) {
      haptics.error();
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet title="Tambah barang" onClose={onClose}>
      <FormField
        label="Barang"
        onValueChange={setName}
        keyboardOptions={{ capitalization: "sentences" }}
      />
      <FormField
        label="Catatan (opsional)"
        onValueChange={setNote}
        keyboardOptions={{ capitalization: "sentences" }}
      />
      <SheetActions
        onCancel={onClose}
        onSubmit={save}
        submitLabel="Tambah"
        enabled={name.trim().length > 0}
        loading={saving}
      />
    </FormSheet>
  );
};

/**
 * Proof of purchase: a photo of the item and of the receipt. Each box turns
 * into the camera in place (gallery picker inside), one at a time.
 * Both upload on send.
 */
export const SubmitShoppingSheet = ({
  item,
  userId,
  onClose,
  onSubmitted,
}: {
  item: ShoppingItem;
  userId: string;
  onClose: () => void;
  onSubmitted: (status: string) => void;
}) => {
  const colors = useAppColors();
  const contentWidth = useSheetContentWidth();
  const halfWidth = (contentWidth - ROW_GAP) / 2;
  const [itemPhoto, setItemPhoto] = useState<LocalImage | null>(null);
  const [receiptPhoto, setReceiptPhoto] = useState<LocalImage | null>(null);
  const [live, setLive] = useState<"item" | "receipt" | null>(null);
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!itemPhoto || !receiptPhoto) return;
    setSending(true);
    try {
      const [itemUrl, receiptUrl] = await Promise.all([
        uploadResizedAsset(itemPhoto, BUCKET, userId),
        uploadResizedAsset(receiptPhoto, BUCKET, userId),
      ]);
      const { data, error } = await shoppingApi.submit(item.id, itemUrl, receiptUrl);
      if (error) throw error;
      haptics.success();
      onSubmitted(data);
    } catch (err: any) {
      haptics.error();
      alert(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <FormSheet
      title={item.status === "rejected" ? "Upload ulang" : "Sudah beli"}
      subtitle={item.name}
      focused={live !== null}
      skipPartial
      onClose={live ? () => setLive(null) : onClose}
    >
      {item.reject_note ? (
        <Collapse visible={live === null}>
          <Text style={{ typography: "bodyMedium" }} color={colors.error}>
            {`Ditolak: ${item.reject_note}`}
          </Text>
        </Collapse>
      ) : null}
      <Row modifiers={[fillMaxWidth()]}>
        <SideCollapse visible={live !== "receipt"}>
          <CameraSlot
            label="Foto barang"
            icon={PhotoCamera}
            photo={itemPhoto}
            live={live === "item"}
            slotHeight={SLOT_HEIGHT}
            slotWidth={halfWidth}
            liveWidth={contentWidth}
            onOpen={() => setLive("item")}
            onClose={() => setLive(null)}
            onCapture={(photo) => {
              setItemPhoto(photo);
              setLive(null);
            }}
          />
        </SideCollapse>
        <SideCollapse visible={live === null}>
          <Spacer modifiers={[width(ROW_GAP)]} />
        </SideCollapse>
        <SideCollapse visible={live !== "item"}>
          <CameraSlot
            label="Foto struk"
            icon={ReceiptLong}
            photo={receiptPhoto}
            live={live === "receipt"}
            slotHeight={SLOT_HEIGHT}
            slotWidth={halfWidth}
            liveWidth={contentWidth}
            onOpen={() => setLive("receipt")}
            onClose={() => setLive(null)}
            onCapture={(photo) => {
              setReceiptPhoto(photo);
              setLive(null);
            }}
          />
        </SideCollapse>
      </Row>
      <Collapse visible={live === null}>
        <SheetActions
          onCancel={onClose}
          onSubmit={send}
          submitLabel="Kirim"
          enabled={!!itemPhoto && !!receiptPhoto}
          loading={sending}
        />
      </Collapse>
    </FormSheet>
  );
};

/** Author rejects a proof, with an optional reason for the buyer. */
export const RejectShoppingSheet = ({
  item,
  onClose,
  onRejected,
}: {
  item: ShoppingItem;
  onClose: () => void;
  onRejected: () => void;
}) => {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const reject = async () => {
    setSaving(true);
    try {
      const { error } = await shoppingApi.review(item.id, false, note.trim() || undefined);
      if (error) throw error;
      haptics.error();
      onRejected();
    } catch (err: any) {
      haptics.error();
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormSheet title="Tolak bukti" subtitle={item.name} onClose={onClose}>
      <FormField
        label="Alasan (opsional)"
        onValueChange={setNote}
        minLines={2}
        keyboardOptions={{ capitalization: "sentences" }}
      />
      <SheetActions
        onCancel={onClose}
        onSubmit={reject}
        submitLabel="Tolak"
        destructive
        loading={saving}
      />
    </FormSheet>
  );
};
