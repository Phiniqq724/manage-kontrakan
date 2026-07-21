import { ButtonContent } from "@/components/ButtonContent";
import { paymentMethodsApi } from "@/services/api";
import { seedTextField } from "@/utils/seed-text-field";
import type { Database } from "@/utils/supabase-types";
import { pickAndUploadImage } from "@/utils/upload";
import AccountBalance from "@expo/material-symbols/account_balance.xml";
import AccountBalanceWallet from "@expo/material-symbols/account_balance_wallet.xml";
import Add from "@expo/material-symbols/add.xml";
import ArrowDropDown from "@expo/material-symbols/arrow_drop_down.xml";
import Delete from "@expo/material-symbols/delete.xml";
import Edit from "@expo/material-symbols/edit.xml";
import MoreVert from "@expo/material-symbols/more_vert.xml";
import QrCode2 from "@expo/material-symbols/qr_code_2.xml";
import type { TextFieldRef } from "@expo/ui/jetpack-compose";
import {
  Box,
  Button,
  CircularWavyProgressIndicator,
  Column,
  DropdownMenu,
  DropdownMenuItem,
  ExposedDropdownMenu,
  ExposedDropdownMenuBox,
  Icon,
  IconButton,
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
  border,
  clickable,
  clip,
  fillMaxWidth,
  height,
  imePadding,
  menuAnchor,
  padding,
  paddingAll,
  Shapes,
  size,
  verticalScroll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useEffect, useRef, useState } from "react";
import { Image, type ImageSourcePropType } from "react-native";

export type PaymentMethodRow =
  Database["public"]["Tables"]["payment_methods"]["Row"];
type PaymentMethodType = "bank" | "emoney" | "qris";

const BANKS = [
  "BCA",
  "BNI",
  "BRI",
  "Mandiri",
  "BSI",
  "CIMB Niaga",
  "Permata",
  "Danamon",
  "Jago",
];

const EMONEY_PROVIDERS = ["GoPay", "OVO", "DANA", "ShopeePay", "LinkAja"];

const TYPE_ICON: Record<PaymentMethodType, ImageSourcePropType> = {
  bank: AccountBalance,
  emoney: AccountBalanceWallet,
  qris: QrCode2,
};

const TYPE_LABEL: Record<PaymentMethodType, string> = {
  bank: "Bank",
  emoney: "E-money",
  qris: "QRIS",
};

function maskAccount(accountNumber: string | null) {
  if (!accountNumber) return "-";
  return `•••• ${accountNumber.slice(-4)}`;
}

export function PaymentMethodsListSheet({
  userId,
  onClose,
  onAdd,
  onEdit,
}: {
  userId: string;
  onClose: () => void;
  onAdd: () => void;
  onEdit: (method: PaymentMethodRow) => void;
}) {
  const colors = useMaterialColors();
  const [methods, setMethods] = useState<PaymentMethodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuForId, setMenuForId] = useState<string | null>(null);

  useEffect(() => {
    paymentMethodsApi.getByUser(userId).then(({ data }) => {
      setMethods(data ?? []);
      setLoading(false);
    });
  }, [userId]);

  const handleDelete = async (id: string) => {
    setMenuForId(null);
    const { error } = await paymentMethodsApi.delete(id);
    if (error) {
      alert(error.message);
      return;
    }
    setMethods((prev) => prev.filter((m) => m.id !== id));
  };

  const grouped: Record<PaymentMethodType, PaymentMethodRow[]> = {
    bank: [],
    emoney: [],
    qris: [],
  };
  methods.forEach((m) => grouped[m.type as PaymentMethodType]?.push(m));

  return (
    <ModalBottomSheet onDismissRequest={onClose}>
      <Column
        verticalArrangement={{ spacedBy: 16 }}
        modifiers={[fillMaxWidth(), verticalScroll(), padding(24, 8, 24, 32)]}
      >
        <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
          <Text
            style={{ typography: "headlineSmall", fontWeight: "bold" }}
            color={colors.onSurface}
            modifiers={[weight(1)]}
          >
            Metode Pembayaran
          </Text>
          <IconButton onClick={onAdd}>
            <Icon source={Add} tint={colors.primary} size={22} />
          </IconButton>
        </Row>

        {loading ? (
          <Text
            style={{ typography: "bodyMedium" }}
            color={colors.onSurfaceVariant}
          >
            Memuat...
          </Text>
        ) : methods.length === 0 ? (
          <Column
            horizontalAlignment="center"
            verticalArrangement={{ spacedBy: 12 }}
            modifiers={[fillMaxWidth(), padding(8, 28, 8, 28)]}
          >
            <Box
              contentAlignment="center"
              modifiers={[
                size(72, 72),
                clip(Shapes.RoundedCorner(36)),
                background(colors.secondaryContainer),
              ]}
            >
              <Icon
                source={AccountBalanceWallet}
                tint={colors.onSecondaryContainer}
                size={32}
              />
            </Box>
            <Column
              horizontalAlignment="center"
              verticalArrangement={{ spacedBy: 2 }}
            >
              <Text
                style={{ typography: "bodyLarge", fontWeight: "bold" }}
                color={colors.onSurface}
              >
                Belum ada metode pembayaran
              </Text>
              <Text
                style={{ typography: "bodySmall", textAlign: "center" }}
                color={colors.onSurfaceVariant}
              >
                Tambahkan bank, e-money, atau QRIS lewat tombol + di atas.
              </Text>
            </Column>
          </Column>
        ) : (
          (["bank", "emoney", "qris"] as const).map(
            (type) =>
              grouped[type].length > 0 && (
                <Column key={type} verticalArrangement={{ spacedBy: 6 }}>
                  <Text
                    style={{
                      typography: "labelMedium",
                      fontWeight: "bold",
                      letterSpacing: 0.5,
                    }}
                    color={colors.onSurfaceVariant}
                  >
                    {TYPE_LABEL[type].toUpperCase()}
                  </Text>
                  {grouped[type].map((m) => (
                    <OutlinedCard
                      key={m.id}
                      border={{ color: colors.outlineVariant }}
                      modifiers={[fillMaxWidth(), clickable(() => onEdit(m))]}
                    >
                      <Row
                        verticalAlignment="center"
                        horizontalArrangement={{ spacedBy: 13 }}
                        modifiers={[fillMaxWidth(), paddingAll(14)]}
                      >
                        <Box
                          contentAlignment="center"
                          modifiers={[
                            size(46, 46),
                            clip(Shapes.RoundedCorner(14)),
                            background(colors.secondaryContainer),
                          ]}
                        >
                          <Icon
                            source={TYPE_ICON[type]}
                            tint={colors.onSecondaryContainer}
                            size={22}
                          />
                        </Box>
                        <Column
                          verticalArrangement={{ spacedBy: 2 }}
                          modifiers={[weight(1)]}
                        >
                          <Text
                            style={{
                              typography: "bodyLarge",
                              fontWeight: "600",
                            }}
                            color={colors.onSurface}
                          >
                            {m.provider_name}
                          </Text>
                          <Text
                            style={{ typography: "bodySmall" }}
                            color={colors.onSurfaceVariant}
                            overflow="ellipsis"
                            maxLines={1}
                          >
                            {m.type === "qris"
                              ? "QRIS terunggah"
                              : maskAccount(m.account_number)}
                          </Text>
                        </Column>
                        <DropdownMenu
                          expanded={menuForId === m.id}
                          onDismissRequest={() => setMenuForId(null)}
                        >
                          <DropdownMenu.Trigger>
                            <IconButton onClick={() => setMenuForId(m.id)}>
                              <Icon
                                source={MoreVert}
                                tint={colors.onSurfaceVariant}
                                size={22}
                              />
                            </IconButton>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Items>
                            <DropdownMenuItem
                              onClick={() => {
                                setMenuForId(null);
                                onEdit(m);
                              }}
                            >
                              <DropdownMenuItem.LeadingIcon>
                                <Icon
                                  source={Edit}
                                  tint={colors.onSurfaceVariant}
                                  size={18}
                                />
                              </DropdownMenuItem.LeadingIcon>
                              <DropdownMenuItem.Text>
                                <Text>Edit</Text>
                              </DropdownMenuItem.Text>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(m.id)}
                            >
                              <DropdownMenuItem.LeadingIcon>
                                <Icon
                                  source={Delete}
                                  tint={colors.error}
                                  size={18}
                                />
                              </DropdownMenuItem.LeadingIcon>
                              <DropdownMenuItem.Text>
                                <Text color={colors.error}>Hapus</Text>
                              </DropdownMenuItem.Text>
                            </DropdownMenuItem>
                          </DropdownMenu.Items>
                        </DropdownMenu>
                      </Row>
                    </OutlinedCard>
                  ))}
                </Column>
              ),
          )
        )}
      </Column>
    </ModalBottomSheet>
  );
}

export function PaymentMethodFormSheet({
  userId,
  userFullname,
  method,
  onClose,
  onSaved,
}: {
  userId: string;
  userFullname: string;
  method?: PaymentMethodRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const colors = useMaterialColors();
  const isEditing = !!method;

  const [type, setType] = useState<PaymentMethodType>(
    (method?.type as PaymentMethodType) ?? "bank",
  );
  const [bankMenuOpen, setBankMenuOpen] = useState(false);
  const [bank, setBank] = useState<string | null>(
    method?.type === "bank" ? method.provider_name : null,
  );
  const [emoneyMenuOpen, setEmoneyMenuOpen] = useState(false);
  const [emoneyProvider, setEmoneyProvider] = useState<string | null>(
    method?.type === "emoney" ? method.provider_name : null,
  );
  const [accountNumber, setAccountNumber] = useState(
    method?.account_number ?? "",
  );
  const [qrisUrl, setQrisUrl] = useState<string | null>(
    method?.qris_image_url ?? null,
  );
  const [loadedQrisUrl, setLoadedQrisUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const accountNumberRef = useRef<TextFieldRef>(null);

  useEffect(() => {
    if (method?.account_number) {
      seedTextField(accountNumberRef, method.account_number);
    }
    // Seed the native field once on mount; deliberately not re-run on prop changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const providerName =
    type === "bank"
      ? bank
      : type === "emoney"
        ? emoneyProvider
        : "QRIS pribadi";

  const canSave =
    type === "qris"
      ? !!qrisUrl
      : !!providerName && accountNumber.trim().length > 0;

  const handlePickQris = async () => {
    setUploading(true);
    try {
      const url = await pickAndUploadImage("qris-codes", userId);
      if (url) setQrisUrl(url);
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
      const payload = {
        type,
        provider_name: providerName!,
        account_number: type === "qris" ? null : accountNumber.trim(),
        account_holder: type === "qris" ? null : userFullname,
        qris_image_url: type === "qris" ? qrisUrl : null,
      };
      const { error } = isEditing
        ? await paymentMethodsApi.update(method!.id, payload)
        : await paymentMethodsApi.create({ user_id: userId, ...payload });
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
          {isEditing ? "Edit metode" : "Tambah metode"}
        </Text>

        <Column verticalArrangement={{ spacedBy: 8 }}>
          <Text
            style={{ typography: "labelMedium", fontWeight: "bold" }}
            color={colors.onSurface}
          >
            Jenis metode
          </Text>
          <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
            <SegmentedButton
              selected={type === "bank"}
              onClick={() => setType("bank")}
            >
              <SegmentedButton.Label>
                <Text>Bank</Text>
              </SegmentedButton.Label>
            </SegmentedButton>
            <SegmentedButton
              selected={type === "emoney"}
              onClick={() => setType("emoney")}
            >
              <SegmentedButton.Label>
                <Text>E-money</Text>
              </SegmentedButton.Label>
            </SegmentedButton>
            <SegmentedButton
              selected={type === "qris"}
              onClick={() => setType("qris")}
            >
              <SegmentedButton.Label>
                <Text>QRIS</Text>
              </SegmentedButton.Label>
            </SegmentedButton>
          </SingleChoiceSegmentedButtonRow>
        </Column>

        {type !== "qris" ? (
          <>
            <Column verticalArrangement={{ spacedBy: 7 }}>
              <Text
                style={{ typography: "labelMedium", fontWeight: "bold" }}
                color={colors.onSurface}
              >
                {type === "bank" ? "Pilih bank" : "Pilih provider"}
              </Text>
              <ExposedDropdownMenuBox
                expanded={type === "bank" ? bankMenuOpen : emoneyMenuOpen}
                onExpandedChange={
                  type === "bank" ? setBankMenuOpen : setEmoneyMenuOpen
                }
              >
                <Row
                  verticalAlignment="center"
                  horizontalArrangement="spaceBetween"
                  modifiers={[
                    fillMaxWidth(),
                    height(56),
                    border(1, colors.outline),
                    clip(Shapes.RoundedCorner(8)),
                    padding(16, 0, 16, 0),
                    menuAnchor(),
                  ]}
                >
                  <Text
                    style={{ typography: "bodyLarge" }}
                    color={
                      (type === "bank" ? bank : emoneyProvider)
                        ? colors.onSurface
                        : colors.onSurfaceVariant
                    }
                  >
                    {(type === "bank" ? bank : emoneyProvider) ??
                      (type === "bank" ? "Pilih bank" : "Pilih provider")}
                  </Text>
                  <Icon
                    source={ArrowDropDown}
                    tint={colors.onSurfaceVariant}
                    size={22}
                  />
                </Row>
                <ExposedDropdownMenu
                  expanded={type === "bank" ? bankMenuOpen : emoneyMenuOpen}
                  onDismissRequest={() =>
                    type === "bank"
                      ? setBankMenuOpen(false)
                      : setEmoneyMenuOpen(false)
                  }
                  modifiers={[height(240)]}
                >
                  {(type === "bank" ? BANKS : EMONEY_PROVIDERS).map((opt) => (
                    <DropdownMenuItem
                      key={opt}
                      onClick={() => {
                        if (type === "bank") {
                          setBank(opt);
                          setBankMenuOpen(false);
                        } else {
                          setEmoneyProvider(opt);
                          setEmoneyMenuOpen(false);
                        }
                      }}
                    >
                      <DropdownMenuItem.Text>
                        <Text>{opt}</Text>
                      </DropdownMenuItem.Text>
                    </DropdownMenuItem>
                  ))}
                </ExposedDropdownMenu>
              </ExposedDropdownMenuBox>
            </Column>

            <OutlinedTextField
              ref={accountNumberRef}
              singleLine
              onValueChange={setAccountNumber}
              keyboardOptions={{ keyboardType: "number" }}
              modifiers={[fillMaxWidth()]}
            >
              <OutlinedTextField.Label>
                <Text>
                  {type === "bank" ? "Nomor rekening" : "Nomor HP / akun"}
                </Text>
              </OutlinedTextField.Label>
            </OutlinedTextField>
          </>
        ) : (
          <Column verticalArrangement={{ spacedBy: 8 }}>
            <Text
              style={{ typography: "labelMedium", fontWeight: "bold" }}
              color={colors.onSurface}
            >
              Gambar QRIS
            </Text>
            <OutlinedCard
              border={{ width: 2, color: colors.outline }}
              colors={{ containerColor: colors.surfaceContainerLow }}
              modifiers={[fillMaxWidth(), clickable(handlePickQris)]}
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
                ) : qrisUrl ? (
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
                          source={{ uri: qrisUrl }}
                          style={{ width: "100%", height: "100%" }}
                          resizeMode="contain"
                          onLoad={() => setLoadedQrisUrl(qrisUrl)}
                        />
                      </RNHostView>
                      {loadedQrisUrl !== qrisUrl && (
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
                      QRIS terunggah · ketuk untuk ganti
                    </Text>
                  </>
                ) : (
                  <>
                    <Icon source={QrCode2} tint={colors.primary} size={48} />
                    <Text
                      style={{ typography: "bodyMedium", fontWeight: "600" }}
                      color={colors.onSurface}
                    >
                      Unggah gambar QRIS
                    </Text>
                    <Text
                      style={{ typography: "bodySmall" }}
                      color={colors.onSurfaceVariant}
                    >
                      Foto / screenshot QRIS dari aplikasi bank atau e-wallet
                      kamu.
                    </Text>
                  </>
                )}
              </Column>
            </OutlinedCard>
          </Column>
        )}

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
              label={isEditing ? "Ubah Metode" : "Tambah Metode"}
              color={colors.onPrimary}
            />
          </Button>
        </Row>
      </Column>
    </ModalBottomSheet>
  );
}
