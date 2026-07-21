import { ButtonContent } from "@/components/ButtonContent";
import { receiptsApi } from "@/services/api";
import type { Database } from "@/utils/supabase-types";
import { pickAndUploadImage } from "@/utils/upload";
import Bolt from "@expo/material-symbols/bolt.xml";
import Delete from "@expo/material-symbols/delete.xml";
import Receipt from "@expo/material-symbols/receipt.xml";
import RequestQuote from "@expo/material-symbols/request_quote.xml";
import WaterDrop from "@expo/material-symbols/water_drop.xml";
import Wifi from "@expo/material-symbols/wifi.xml";
import {
  Box,
  Button,
  CircularWavyProgressIndicator,
  Column,
  Icon,
  ModalBottomSheet,
  OutlinedButton,
  OutlinedCard,
  OutlinedTextField,
  RNHostView,
  Row,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Text,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  background,
  clickable,
  clip,
  fillMaxWidth,
  height,
  imePadding,
  padding,
  Shapes,
  size,
  verticalScroll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useState } from "react";
import { Image, type ImageSourcePropType } from "react-native";

export type ReceiptRow = Database["public"]["Tables"]["receipts"]["Row"];
export type ReceiptCategory =
  | "water"
  | "wifi"
  | "electricity"
  | "village_fee"
  | "other";

export const RECEIPT_CATEGORIES: {
  key: ReceiptCategory;
  label: string;
  shortLabel: string;
  icon: ImageSourcePropType;
}[] = [
  { key: "water", label: "Air / PDAM", shortLabel: "Air", icon: WaterDrop },
  { key: "wifi", label: "WiFi", shortLabel: "WiFi", icon: Wifi },
  {
    key: "electricity",
    label: "Listrik / PLN",
    shortLabel: "Listrik",
    icon: Bolt,
  },
  {
    key: "village_fee",
    label: "Iuran Desa",
    shortLabel: "Desa",
    icon: RequestQuote,
  },
  { key: "other", label: "Lainnya", shortLabel: "Lain", icon: Receipt },
];

export function receiptCategoryInfo(category: string) {
  return (
    RECEIPT_CATEGORIES.find((c) => c.key === category) ??
    RECEIPT_CATEGORIES[RECEIPT_CATEGORIES.length - 1]
  );
}

export function formatRupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

export function ReceiptFormSheet({
  userId,
  onClose,
  onSaved,
}: {
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const colors = useMaterialColors();

  const [category, setCategory] = useState<ReceiptCategory>("water");
  const [amount, setAmount] = useState("");
  const [docs, setDocs] = useState<string | null>(null);
  const [loadedDocs, setLoadedDocs] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const amountValue = parseInt(amount.replace(/[^0-9]/g, ""), 10);
  const canSave = !!docs && !isNaN(amountValue) && amountValue > 0;

  const handlePickReceipt = async () => {
    setUploading(true);
    try {
      const url = await pickAndUploadImage("receipts", category);
      if (url) setDocs(url);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const { error } = await receiptsApi.create({
        category,
        amount: amountValue,
        docs: docs!,
        created_by: userId,
      });
      if (error) throw error;
      onSaved();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalBottomSheet onDismissRequest={onClose}>
      <Column
        verticalArrangement={{ spacedBy: 16 }}
        modifiers={[
          fillMaxWidth(),
          verticalScroll(),
          imePadding(),
          padding(24, 8, 24, 32),
        ]}
      >
        <Text
          style={{ typography: "headlineSmall", fontWeight: "bold" }}
          color={colors.onSurface}
        >
          Tambah kwitansi
        </Text>

        <Column verticalArrangement={{ spacedBy: 7 }}>
          <Text
            style={{ typography: "labelMedium", fontWeight: "bold" }}
            color={colors.onSurface}
          >
            Kategori
          </Text>
          <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
            {RECEIPT_CATEGORIES.map((c) => (
              <SegmentedButton
                key={c.key}
                selected={category === c.key}
                onClick={() => setCategory(c.key)}
              >
                <SegmentedButton.Label>
                  <Text>{c.shortLabel}</Text>
                </SegmentedButton.Label>
              </SegmentedButton>
            ))}
          </SingleChoiceSegmentedButtonRow>
        </Column>

        <OutlinedTextField
          singleLine
          onValueChange={setAmount}
          keyboardOptions={{ keyboardType: "number" }}
          modifiers={[fillMaxWidth()]}
        >
          <OutlinedTextField.Label>
            <Text>Nominal (Rp)</Text>
          </OutlinedTextField.Label>
        </OutlinedTextField>

        <Column verticalArrangement={{ spacedBy: 8 }}>
          <Text
            style={{ typography: "labelMedium", fontWeight: "bold" }}
            color={colors.onSurface}
          >
            Foto kwitansi
          </Text>
          <OutlinedCard
            border={{ width: 2, color: colors.outline }}
            colors={{ containerColor: colors.surfaceContainerLow }}
            modifiers={[fillMaxWidth(), clickable(handlePickReceipt)]}
          >
            <Column
              horizontalAlignment="center"
              verticalArrangement={{ spacedBy: 12 }}
              modifiers={[fillMaxWidth(), padding(18, 26, 18, 26)]}
            >
              {uploading ? (
                <CircularWavyProgressIndicator
                  color={colors.primary}
                  modifiers={[size(32, 32)]}
                />
              ) : docs ? (
                <>
                  <Box
                    contentAlignment="center"
                    modifiers={[
                      size(140, 140),
                      clip(Shapes.RoundedCorner(16)),
                      background(colors.surfaceContainerHighest),
                    ]}
                  >
                    <RNHostView>
                      <Image
                        source={{ uri: docs }}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode="cover"
                        onLoad={() => setLoadedDocs(docs)}
                      />
                    </RNHostView>
                    {loadedDocs !== docs && (
                      <CircularWavyProgressIndicator
                        color={colors.primary}
                        modifiers={[size(28, 28)]}
                      />
                    )}
                  </Box>
                  <Text
                    style={{ typography: "bodyMedium", fontWeight: "600" }}
                    color={colors.onSurface}
                  >
                    Foto terunggah · ketuk untuk ganti
                  </Text>
                </>
              ) : (
                <>
                  <Icon source={Receipt} tint={colors.primary} size={48} />
                  <Text
                    style={{ typography: "bodyMedium", fontWeight: "600" }}
                    color={colors.onSurface}
                  >
                    Unggah foto kwitansi
                  </Text>
                  <Text
                    style={{ typography: "bodySmall", textAlign: "center" }}
                    color={colors.onSurfaceVariant}
                  >
                    Foto struk atau tagihan dari galeri kamu.
                  </Text>
                </>
              )}
            </Column>
          </OutlinedCard>
        </Column>

        <Row
          verticalAlignment="center"
          horizontalArrangement={{ spacedBy: 12 }}
          modifiers={[fillMaxWidth()]}
        >
          <OutlinedButton onClick={onClose} modifiers={[weight(1)]}>
            <Text style={{ typography: "labelLarge" }} color={colors.primary}>
              Batal
            </Text>
          </OutlinedButton>
          <Button
            enabled={canSave && !saving}
            onClick={handleSave}
            modifiers={[weight(1)]}
          >
            <ButtonContent
              loading={saving}
              enabled={canSave}
              label="Simpan Kwitansi"
              color={colors.onPrimary}
            />
          </Button>
        </Row>
      </Column>
    </ModalBottomSheet>
  );
}

export function ReceiptDetailSheet({
  receipt,
  uploaderName,
  isAdmin,
  onClose,
  onDeleted,
}: {
  receipt: ReceiptRow;
  uploaderName: string;
  isAdmin: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const colors = useMaterialColors();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const categoryInfo = receiptCategoryInfo(receipt.category);
  const formattedDate = new Date(receipt.created_at).toLocaleDateString(
    "id-ID",
    { day: "2-digit", month: "long", year: "numeric" },
  );

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await receiptsApi.delete(receipt.id);
      if (error) throw error;
      onDeleted();
    } catch (err: any) {
      alert(err.message);
      setDeleting(false);
    }
  };

  return (
    <ModalBottomSheet onDismissRequest={onClose}>
      <Column
        verticalArrangement={{ spacedBy: 16 }}
        modifiers={[fillMaxWidth(), verticalScroll(), padding(24, 8, 24, 32)]}
      >
        <Row
          verticalAlignment="center"
          horizontalArrangement={{ spacedBy: 12 }}
          modifiers={[fillMaxWidth()]}
        >
          <Box
            contentAlignment="center"
            modifiers={[
              size(44, 44),
              clip(Shapes.RoundedCorner(14)),
              background(colors.secondaryContainer),
            ]}
          >
            <Icon
              source={categoryInfo.icon}
              tint={colors.onSecondaryContainer}
              size={22}
            />
          </Box>
          <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[weight(1)]}>
            <Text
              style={{ typography: "titleMedium", fontWeight: "bold" }}
              color={colors.onSurface}
            >
              {categoryInfo.label}
            </Text>
            <Text
              style={{ typography: "bodySmall" }}
              color={colors.onSurfaceVariant}
            >
              {`Diunggah ${formattedDate} oleh ${uploaderName}`}
            </Text>
          </Column>
        </Row>

        <Text
          style={{ typography: "headlineMedium", fontWeight: "bold" }}
          color={colors.onSurface}
        >
          {formatRupiah(receipt.amount)}
        </Text>

        <Box
          contentAlignment="center"
          modifiers={[
            fillMaxWidth(),
            height(320),
            clip(Shapes.RoundedCorner(16)),
            background(colors.surfaceContainerHighest),
          ]}
        >
          <RNHostView>
            <Image
              source={{ uri: receipt.docs }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="contain"
              onLoad={() => setImageLoaded(true)}
            />
          </RNHostView>
          {!imageLoaded && (
            <CircularWavyProgressIndicator
              color={colors.primary}
              modifiers={[size(32, 32)]}
            />
          )}
        </Box>

        {isAdmin && (
          <OutlinedButton
            enabled={!deleting}
            onClick={handleDelete}
            colors={{ contentColor: colors.error }}
            modifiers={[fillMaxWidth()]}
          >
            <Row
              verticalAlignment="center"
              horizontalArrangement={{ spacedBy: 8 }}
            >
              {deleting ? (
                <CircularWavyProgressIndicator
                  color={colors.error}
                  modifiers={[size(20, 20)]}
                />
              ) : (
                <>
                  <Icon source={Delete} tint={colors.error} size={18} />
                  <Text
                    style={{ typography: "labelLarge" }}
                    color={colors.error}
                  >
                    Hapus Kwitansi
                  </Text>
                </>
              )}
            </Row>
          </OutlinedButton>
        )}
      </Column>
    </ModalBottomSheet>
  );
}
