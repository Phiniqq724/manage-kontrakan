import { Avatar, avatarColorFor } from "@/components/Avatar";
import { ButtonContent } from "@/components/ButtonContent";
import { ImageViewerModal } from "@/components/ImageViewerModal";
import {
  paymentMethodsApi,
  splitBillParticipantsApi,
  splitBillPaymentMethodsApi,
  splitBillsApi,
  usersApi,
} from "@/services/api";
import { cooldownRemaining, formatCooldown } from "@/utils/cooldown";
import { sendPushNotification } from "@/utils/notifications";
import { seedTextField } from "@/utils/seed-text-field";
import type { Database } from "@/utils/supabase-types";
import { pickAndUploadImage } from "@/utils/upload";
import AccountBalance from "@expo/material-symbols/account_balance.xml";
import AccountBalanceWallet from "@expo/material-symbols/account_balance_wallet.xml";
import Add from "@expo/material-symbols/add.xml";
import AddAPhoto from "@expo/material-symbols/add_a_photo.xml";
import Check from "@expo/material-symbols/check.xml";
import Close from "@expo/material-symbols/close.xml";
import ContentCopy from "@expo/material-symbols/content_copy.xml";
import NotificationsActive from "@expo/material-symbols/notifications_active.xml";
import QrCode2 from "@expo/material-symbols/qr_code_2.xml";
import {
  AssistChip,
  BasicAlertDialog,
  Box,
  Button,
  Card,
  Checkbox,
  CircularWavyProgressIndicator,
  Column,
  DropdownMenu,
  DropdownMenuItem,
  FlowRow,
  HorizontalDivider,
  Icon,
  InputChip,
  LinearProgressIndicator,
  ModalBottomSheet,
  OutlinedButton,
  OutlinedCard,
  OutlinedTextField,
  RadioButton,
  RNHostView,
  Row,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Text,
  useMaterialColors,
  type MaterialColors,
  type TextFieldRef,
} from "@expo/ui/jetpack-compose";
import {
  background,
  clickable,
  clip,
  fillMaxWidth,
  height,
  imePadding,
  padding,
  paddingAll,
  selectable,
  Shapes,
  size,
  toggleable,
  verticalScroll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import * as Clipboard from "expo-clipboard";
import { useEffect, useRef, useState } from "react";
import { Image, type ImageSourcePropType } from "react-native";

type UserRow = Database["public"]["Tables"]["users"]["Row"];
type PaymentMethodRow = Database["public"]["Tables"]["payment_methods"]["Row"];
type SplitBillRow = Database["public"]["Tables"]["split_bills"]["Row"];
export type SplitBillParticipantRow =
  Database["public"]["Tables"]["split_bill_participants"]["Row"];
type SplitBillPaymentMethodRow =
  Database["public"]["Tables"]["split_bill_payment_methods"]["Row"] & {
    payment_methods: PaymentMethodRow;
  };
export type SplitBillDetail = SplitBillRow & {
  split_bill_participants: SplitBillParticipantRow[];
  split_bill_payment_methods: SplitBillPaymentMethodRow[];
};
type SplitType = "equal" | "dynamic";

/**
 * A participant being assembled in the creation form, before the bill (and
 * its `split_bill_participants` rows) exists. `userId` is null for a custom
 * (unregistered) participant — `key` is what the draft list is keyed by
 * instead, since a custom entry has no real id until after submit.
 */
type DraftParticipant = { key: string; userId: string | null; displayName: string };

const TYPE_ICON: Record<string, ImageSourcePropType> = {
  bank: AccountBalance,
  emoney: AccountBalanceWallet,
  qris: QrCode2,
};

const PARTICIPANT_STATUS_LABEL: Record<string, string> = {
  unpaid: "Belum bayar",
  pending_verification: "Perlu verifikasi",
  paid: "Lunas",
  rejected: "Bukti ditolak",
};

const MAX_PAYMENT_METHODS = 3;

function formatRupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function parseAmount(text: string) {
  return parseInt(text.replace(/[^0-9]/g, ""), 10) || 0;
}

function statusColor(status: string, colors: MaterialColors) {
  switch (status) {
    case "paid":
      return { bg: colors.tertiaryContainer, fg: colors.onTertiaryContainer };
    case "unpaid":
    case "rejected":
      return { bg: colors.errorContainer, fg: colors.onErrorContainer };
    default:
      return {
        bg: colors.secondaryContainer,
        fg: colors.onSecondaryContainer,
      };
  }
}

export function CreateSplitBillSheet({
  userId,
  userFullname,
  onClose,
  onCreated,
}: {
  userId: string;
  userFullname: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const colors = useMaterialColors();

  const [allUsers, setAllUsers] = useState<UserRow[]>([]);
  const [methods, setMethods] = useState<PaymentMethodRow[]>([]);
  const [addUserMenuOpen, setAddUserMenuOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [participants, setParticipants] = useState<DraftParticipant[]>([
    { key: userId, userId, displayName: userFullname },
  ]);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [customNameText, setCustomNameText] = useState("");
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [subtotalText, setSubtotalText] = useState("");
  const [taxText, setTaxText] = useState("11");
  const [ppnIncluded, setPpnIncluded] = useState(false);
  const [lastManualTax, setLastManualTax] = useState("11");
  const taxFieldRef = useRef<TextFieldRef>(null);
  const [perItemAmounts, setPerItemAmounts] = useState<Record<string, string>>(
    {},
  );
  const [selectedMethodIds, setSelectedMethodIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([usersApi.getAll(), paymentMethodsApi.getByUser(userId)]).then(
      ([usersRes, methodsRes]) => {
        setAllUsers(usersRes.data ?? []);
        setMethods(methodsRes.data ?? []);
      },
    );
  }, [userId]);

  const addableUsers = allUsers.filter(
    (u) => !participants.some((p) => p.userId === u.id),
  );

  const taxPercentage = ppnIncluded ? 0 : parseAmount(taxText);
  const subtotal =
    splitType === "equal"
      ? parseAmount(subtotalText)
      : participants.reduce(
          (sum, p) => sum + parseAmount(perItemAmounts[p.key] ?? ""),
          0,
        );
  const totalAmount = Math.round(subtotal * (1 + taxPercentage / 100));
  const perPerson =
    splitType === "equal" && participants.length > 0
      ? Math.round(totalAmount / participants.length)
      : 0;

  const handleAddCustomParticipant = () => {
    const name = customNameText.trim();
    if (!name) return;
    setParticipants((prev) => [
      ...prev,
      { key: `custom:${Date.now()}:${Math.random()}`, userId: null, displayName: name },
    ]);
    setCustomNameText("");
    setCustomDialogOpen(false);
  };

  const handleTogglePpnIncluded = async () => {
    const next = !ppnIncluded;
    if (next) {
      setLastManualTax(taxText);
      setTaxText("0");
      await seedTextField(taxFieldRef, "0");
    } else {
      setTaxText(lastManualTax);
      await seedTextField(taxFieldRef, lastManualTax);
    }
    setPpnIncluded(next);
  };

  const canSubmit =
    title.trim().length > 0 &&
    participants.length > 0 &&
    subtotal > 0 &&
    selectedMethodIds.length > 0 &&
    !submitting;

  const toggleMethod = (id: string) => {
    setSelectedMethodIds((prev) => {
      if (prev.includes(id)) return prev.filter((m) => m !== id);
      if (prev.length >= MAX_PAYMENT_METHODS) {
        alert(`Maksimal ${MAX_PAYMENT_METHODS} metode pembayaran.`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { data: bill, error: billError } = await splitBillsApi.create({
        creator_id: userId,
        title: title.trim(),
        split_type: splitType,
        tax_percentage: taxPercentage,
        ppn_included_in_price: ppnIncluded,
        subtotal,
        total_amount: totalAmount,
      });
      if (billError || !bill)
        throw billError ?? new Error("Gagal membuat split bill.");

      const amountDueFor = (p: DraftParticipant, index: number) => {
        if (splitType === "equal") {
          const isLast = index === participants.length - 1;
          if (!isLast) return perPerson;
          return totalAmount - perPerson * (participants.length - 1);
        }
        const base = parseAmount(perItemAmounts[p.key] ?? "");
        return Math.round(base * (1 + taxPercentage / 100));
      };

      // The creator has already covered the cost upfront, so their own share
      // starts out paid — everyone else owes them back.
      const { error: participantsError } =
        await splitBillParticipantsApi.createMany(
          participants.map((p, index) => {
            const isCreator = p.userId === userId;
            return {
              split_bill_id: bill.id,
              user_id: p.userId,
              display_name: p.userId ? null : p.displayName,
              amount_due: amountDueFor(p, index),
              payment_status: isCreator ? "paid" : "unpaid",
              paid_at: isCreator ? new Date().toISOString() : null,
            };
          }),
        );
      if (participantsError) throw participantsError;

      const { error: methodsError } =
        await splitBillPaymentMethodsApi.createMany(
          selectedMethodIds.map((paymentMethodId) => ({
            split_bill_id: bill.id,
            payment_method_id: paymentMethodId,
          })),
        );
      if (methodsError) throw methodsError;

      onCreated();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
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
          Buat split bill
        </Text>

        <OutlinedTextField
          singleLine
          onValueChange={setTitle}
          keyboardOptions={{ capitalization: "sentences" }}
          modifiers={[fillMaxWidth()]}
        >
          <OutlinedTextField.Label>
            <Text>Judul</Text>
          </OutlinedTextField.Label>
          <OutlinedTextField.Placeholder>
            <Text>Contoh: Pizza Sabtu malam</Text>
          </OutlinedTextField.Placeholder>
        </OutlinedTextField>

        <Column verticalArrangement={{ spacedBy: 9 }}>
          <Row
            verticalAlignment="center"
            horizontalArrangement="spaceBetween"
            modifiers={[fillMaxWidth()]}
          >
            <Text
              style={{ typography: "labelMedium", fontWeight: "bold" }}
              color={colors.onSurface}
            >
              Peserta
            </Text>
            <Text
              style={{ typography: "labelSmall" }}
              color={colors.onSurfaceVariant}
            >
              {`${participants.length} dipilih`}
            </Text>
          </Row>
          <FlowRow
            horizontalArrangement={{ spacedBy: 8 }}
            verticalArrangement={{ spacedBy: 8 }}
            modifiers={[fillMaxWidth()]}
          >
            {participants.map((p) => {
              const isSelf = p.userId === userId;
              return (
                <InputChip
                  key={p.key}
                  selected
                  enabled={!isSelf}
                  onClick={() =>
                    setParticipants((prev) =>
                      prev.filter((x) => x.key !== p.key),
                    )
                  }
                >
                  <InputChip.Label>
                    <Text>{isSelf ? `${userFullname} (kamu)` : p.displayName}</Text>
                  </InputChip.Label>
                  {!isSelf && (
                    <InputChip.TrailingIcon>
                      <Icon source={Close} size={16} />
                    </InputChip.TrailingIcon>
                  )}
                </InputChip>
              );
            })}
            <DropdownMenu
              expanded={addUserMenuOpen}
              onDismissRequest={() => setAddUserMenuOpen(false)}
            >
              <DropdownMenu.Trigger>
                <AssistChip onClick={() => setAddUserMenuOpen(true)}>
                  <AssistChip.LeadingIcon>
                    <Icon source={Add} tint={colors.primary} size={16} />
                  </AssistChip.LeadingIcon>
                  <AssistChip.Label>
                    <Text color={colors.primary}>Tambah</Text>
                  </AssistChip.Label>
                </AssistChip>
              </DropdownMenu.Trigger>
              <DropdownMenu.Items>
                {addableUsers.length === 0 ? (
                  <DropdownMenuItem enabled={false}>
                    <DropdownMenuItem.Text>
                      <Text>Semua anggota sudah ditambahkan</Text>
                    </DropdownMenuItem.Text>
                  </DropdownMenuItem>
                ) : (
                  addableUsers.map((u) => (
                    <DropdownMenuItem
                      key={u.id}
                      onClick={() => {
                        setParticipants((prev) => [
                          ...prev,
                          { key: u.id, userId: u.id, displayName: u.fullname },
                        ]);
                        setAddUserMenuOpen(false);
                      }}
                    >
                      <DropdownMenuItem.Text>
                        <Text>{u.fullname}</Text>
                      </DropdownMenuItem.Text>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenu.Items>
            </DropdownMenu>
            <AssistChip onClick={() => setCustomDialogOpen(true)}>
              <AssistChip.LeadingIcon>
                <Icon source={Add} tint={colors.primary} size={16} />
              </AssistChip.LeadingIcon>
              <AssistChip.Label>
                <Text color={colors.primary}>Tambah non-anggota</Text>
              </AssistChip.Label>
            </AssistChip>
          </FlowRow>
        </Column>

        {customDialogOpen && (
          <BasicAlertDialog onDismissRequest={() => setCustomDialogOpen(false)}>
            <Column
              verticalArrangement={{ spacedBy: 16 }}
              modifiers={[
                fillMaxWidth(),
                clip(Shapes.RoundedCorner(24)),
                background(colors.surfaceContainerHigh),
                padding(20, 20, 20, 20),
              ]}
            >
              <Text
                style={{ typography: "titleMedium", fontWeight: "bold" }}
                color={colors.onSurface}
              >
                Tambah peserta non-anggota
              </Text>
              <OutlinedTextField
                singleLine
                onValueChange={setCustomNameText}
                keyboardOptions={{ capitalization: "words" }}
                modifiers={[fillMaxWidth()]}
              >
                <OutlinedTextField.Label>
                  <Text>Nama peserta</Text>
                </OutlinedTextField.Label>
              </OutlinedTextField>
              <Row
                verticalAlignment="center"
                horizontalArrangement={{ spacedBy: 12 }}
                modifiers={[fillMaxWidth()]}
              >
                <OutlinedButton
                  onClick={() => setCustomDialogOpen(false)}
                  modifiers={[weight(1)]}
                >
                  <Text
                    style={{ typography: "labelLarge" }}
                    color={colors.primary}
                  >
                    Batal
                  </Text>
                </OutlinedButton>
                <Button
                  enabled={customNameText.trim().length > 0}
                  onClick={handleAddCustomParticipant}
                  modifiers={[weight(1)]}
                >
                  <Text
                    style={{ typography: "labelLarge", fontWeight: "bold" }}
                    color={colors.onPrimary}
                  >
                    Tambah
                  </Text>
                </Button>
              </Row>
            </Column>
          </BasicAlertDialog>
        )}

        <Column verticalArrangement={{ spacedBy: 8 }}>
          <Text
            style={{ typography: "labelMedium", fontWeight: "bold" }}
            color={colors.onSurface}
          >
            Mode pembagian
          </Text>
          <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
            <SegmentedButton
              selected={splitType === "equal"}
              onClick={() => setSplitType("equal")}
            >
              <SegmentedButton.Label>
                <Text>Bagi rata</Text>
              </SegmentedButton.Label>
            </SegmentedButton>
            <SegmentedButton
              selected={splitType === "dynamic"}
              onClick={() => setSplitType("dynamic")}
            >
              <SegmentedButton.Label>
                <Text>Per-item</Text>
              </SegmentedButton.Label>
            </SegmentedButton>
          </SingleChoiceSegmentedButtonRow>
        </Column>

        {splitType === "equal" ? (
          <OutlinedTextField
            singleLine
            onValueChange={setSubtotalText}
            keyboardOptions={{ keyboardType: "number" }}
            modifiers={[fillMaxWidth()]}
          >
            <OutlinedTextField.Label>
              <Text>Subtotal</Text>
            </OutlinedTextField.Label>
            <OutlinedTextField.Placeholder>
              <Text>Rp 0</Text>
            </OutlinedTextField.Placeholder>
          </OutlinedTextField>
        ) : (
          <Column verticalArrangement={{ spacedBy: 14 }}>
            <Text
              style={{ typography: "labelMedium", fontWeight: "bold" }}
              color={colors.onSurface}
            >
              Item per peserta
            </Text>
            {participants.map((p) => {
              const isSelf = p.userId === userId;
              const name = isSelf
                ? `${userFullname} (kamu)`
                : p.displayName;
              return (
                <OutlinedTextField
                  key={p.key}
                  singleLine
                  onValueChange={(text) =>
                    setPerItemAmounts((prev) => ({ ...prev, [p.key]: text }))
                  }
                  keyboardOptions={{ keyboardType: "number" }}
                  modifiers={[fillMaxWidth()]}
                >
                  <OutlinedTextField.Label>
                    <Text>{name}</Text>
                  </OutlinedTextField.Label>
                </OutlinedTextField>
              );
            })}
          </Column>
        )}

        <Column verticalArrangement={{ spacedBy: 9 }}>
          <OutlinedTextField
            ref={taxFieldRef}
            singleLine
            enabled={!ppnIncluded}
            onValueChange={setTaxText}
            keyboardOptions={{ keyboardType: "number" }}
            modifiers={[fillMaxWidth()]}
          >
            <OutlinedTextField.Label>
              <Text>PPN (%)</Text>
            </OutlinedTextField.Label>
          </OutlinedTextField>
          <Row
            verticalAlignment="center"
            horizontalArrangement={{ spacedBy: 8 }}
            modifiers={[
              toggleable(ppnIncluded, handleTogglePpnIncluded, {
                role: "checkbox",
              }),
            ]}
          >
            <Checkbox value={ppnIncluded} />
            <Text style={{ typography: "bodyMedium" }} color={colors.onSurface}>
              Harga sudah termasuk PPN
            </Text>
          </Row>
        </Column>

        <Card
          colors={{ containerColor: colors.surfaceContainer }}
          modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(18))]}
        >
          <Column
            verticalArrangement={{ spacedBy: 9 }}
            modifiers={[fillMaxWidth(), paddingAll(15)]}
          >
            <Row
              horizontalArrangement="spaceBetween"
              modifiers={[fillMaxWidth()]}
            >
              <Text
                style={{ typography: "bodyMedium" }}
                color={colors.onSurfaceVariant}
              >
                Subtotal
              </Text>
              <Text
                style={{ typography: "bodyMedium" }}
                color={colors.onSurfaceVariant}
              >
                {formatRupiah(subtotal)}
              </Text>
            </Row>
            <Row
              horizontalArrangement="spaceBetween"
              modifiers={[fillMaxWidth()]}
            >
              <Text
                style={{ typography: "bodyMedium" }}
                color={colors.onSurfaceVariant}
              >
                {`PPN ${taxPercentage}%`}
              </Text>
              <Text
                style={{ typography: "bodyMedium" }}
                color={colors.onSurfaceVariant}
              >
                {formatRupiah(totalAmount - subtotal)}
              </Text>
            </Row>
            <HorizontalDivider color={colors.outlineVariant} />
            <Row
              horizontalArrangement="spaceBetween"
              modifiers={[fillMaxWidth()]}
            >
              <Text
                style={{ typography: "bodyLarge", fontWeight: "bold" }}
                color={colors.onSurface}
              >
                Total
              </Text>
              <Text
                style={{ typography: "bodyLarge", fontWeight: "bold" }}
                color={colors.onSurface}
              >
                {formatRupiah(totalAmount)}
              </Text>
            </Row>
            {splitType === "equal" && (
              <Row
                horizontalArrangement="spaceBetween"
                modifiers={[fillMaxWidth()]}
              >
                <Text
                  style={{ typography: "bodyMedium", fontWeight: "600" }}
                  color={colors.primary}
                >
                  {`Per orang (÷${participants.length || 1})`}
                </Text>
                <Text
                  style={{ typography: "bodyMedium", fontWeight: "600" }}
                  color={colors.primary}
                >
                  {formatRupiah(perPerson)}
                </Text>
              </Row>
            )}
          </Column>
        </Card>

        <Column verticalArrangement={{ spacedBy: 9 }}>
          <Row
            verticalAlignment="center"
            horizontalArrangement="spaceBetween"
            modifiers={[fillMaxWidth()]}
          >
            <Text
              style={{ typography: "labelMedium", fontWeight: "bold" }}
              color={colors.onSurface}
            >
              Metode terima bayaran
            </Text>
            <Text
              style={{ typography: "labelSmall" }}
              color={colors.onSurfaceVariant}
            >
              {`${selectedMethodIds.length} / ${MAX_PAYMENT_METHODS} dipilih`}
            </Text>
          </Row>
          {methods.length === 0 ? (
            <OutlinedCard
              border={{ color: colors.outlineVariant }}
              modifiers={[fillMaxWidth()]}
            >
              <Row
                verticalAlignment="center"
                horizontalArrangement="spaceBetween"
                modifiers={[fillMaxWidth(), paddingAll(14)]}
              >
                <Text
                  style={{ typography: "bodyMedium" }}
                  color={colors.onSurfaceVariant}
                >
                  Kamu belum punya metode pembayaran. Tambahkan lewat halaman
                  Profil dulu.
                </Text>
              </Row>
            </OutlinedCard>
          ) : (
            methods.map((m) => {
              const selected = selectedMethodIds.includes(m.id);
              return (
                <OutlinedCard
                  key={m.id}
                  border={{ color: colors.outlineVariant }}
                  modifiers={[
                    fillMaxWidth(),
                    clip(Shapes.RoundedCorner(12)),
                    toggleable(selected, () => toggleMethod(m.id), {
                      role: "checkbox",
                    }),
                  ]}
                >
                  <Row
                    verticalAlignment="center"
                    horizontalArrangement={{ spacedBy: 12 }}
                    modifiers={[fillMaxWidth(), padding(13, 11, 13, 11)]}
                  >
                    <Box
                      contentAlignment="center"
                      modifiers={[
                        size(38, 38),
                        clip(Shapes.RoundedCorner(11)),
                        background(colors.secondaryContainer),
                      ]}
                    >
                      <Icon
                        source={TYPE_ICON[m.type] ?? AccountBalance}
                        tint={colors.onSecondaryContainer}
                        size={20}
                      />
                    </Box>
                    <Column
                      verticalArrangement={{ spacedBy: 2 }}
                      modifiers={[weight(1)]}
                    >
                      <Text
                        style={{
                          typography: "bodyMedium",
                          fontWeight: "600",
                        }}
                        color={colors.onSurface}
                      >
                        {m.provider_name}
                      </Text>
                      {m.account_number && (
                        <Text
                          style={{ typography: "labelSmall" }}
                          color={colors.onSurfaceVariant}
                        >
                          {m.account_number}
                        </Text>
                      )}
                    </Column>
                    <Checkbox value={selected} />
                  </Row>
                </OutlinedCard>
              );
            })
          )}
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
            enabled={canSubmit}
            onClick={handleSubmit}
            modifiers={[weight(1)]}
          >
            <ButtonContent
              loading={submitting}
              enabled={canSubmit}
              label="Buat Bill"
              color={colors.onPrimary}
            />
          </Button>
        </Row>
      </Column>
    </ModalBottomSheet>
  );
}

export function SplitBillDetailSheet({
  billId,
  currentUser,
  onClose,
  onPay,
}: {
  billId: string;
  currentUser: UserRow;
  onClose: () => void;
  onPay: (
    bill: SplitBillRow,
    participant: SplitBillParticipantRow,
    offeredMethods: PaymentMethodRow[],
  ) => void;
}) {
  const colors = useMaterialColors();
  const [bill, setBill] = useState<SplitBillDetail | null>(null);
  const [usersById, setUsersById] = useState<Map<string, UserRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadedProofUrls, setLoadedProofUrls] = useState<Set<string>>(
    new Set(),
  );
  const [remindedAt, setRemindedAt] = useState<number | null>(null);
  const [reminding, setReminding] = useState(false);
  const [customPayTarget, setCustomPayTarget] =
    useState<SplitBillParticipantRow | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billId]);

  // Re-renders every second so the reminder cooldown countdown stays live.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  async function loadData() {
    const [billRes, usersRes] = await Promise.all([
      splitBillsApi.getById(billId),
      usersApi.getAll(),
    ]);
    setBill((billRes.data as SplitBillDetail | null) ?? null);
    setUsersById(new Map((usersRes.data ?? []).map((u) => [u.id, u])));
    setLoading(false);
  }

  const handleVerify = async (participantId: string, approve: boolean) => {
    const { error } = await splitBillParticipantsApi.update(participantId, {
      payment_status: approve ? "paid" : "rejected",
    });
    if (error) {
      alert(error.message);
      return;
    }
    loadData();
  };

  const handleRemindUnpaid = async (unpaid: SplitBillParticipantRow[]) => {
    if (cooldownRemaining(remindedAt) > 0) return;
    setReminding(true);
    try {
      const tokens = unpaid
        .map((p) => (p.user_id ? usersById.get(p.user_id)?.push_token : null))
        .filter((t): t is string => !!t);
      await Promise.all(
        tokens.map((token) =>
          sendPushNotification(
            token,
            "Tagihan Belum Dibayar",
            `"${bill!.title}" masih menunggu pembayaranmu.`,
          ),
        ),
      );
      setRemindedAt(Date.now());
    } finally {
      setReminding(false);
    }
  };

  if (loading || !bill) {
    return (
      <ModalBottomSheet onDismissRequest={onClose}>
        <Column
          horizontalAlignment="center"
          modifiers={[fillMaxWidth(), padding(24, 40, 24, 40)]}
        >
          <Text
            style={{ typography: "bodyMedium" }}
            color={colors.onSurfaceVariant}
          >
            {loading ? "Memuat..." : "Split bill tidak ditemukan."}
          </Text>
        </Column>
      </ModalBottomSheet>
    );
  }

  const isCreator = bill.creator_id === currentUser.id;
  const participants = bill.split_bill_participants;
  const total = participants.length;
  const paidCount = participants.filter(
    (p) => p.payment_status === "paid",
  ).length;
  const myRow = participants.find((p) => p.user_id === currentUser.id);
  const offeredMethods = bill.split_bill_payment_methods.map(
    (spm) => spm.payment_methods,
  );
  const unpaidParticipants = participants.filter(
    (p) => p.payment_status === "unpaid" || p.payment_status === "rejected",
  );
  const reminderCooldown = cooldownRemaining(remindedAt);

  return (
    <>
    <ModalBottomSheet onDismissRequest={onClose}>
      <Column
        verticalArrangement={{ spacedBy: 16 }}
        modifiers={[fillMaxWidth(), verticalScroll(), padding(24, 8, 24, 32)]}
      >
        <Text
          style={{ typography: "headlineSmall", fontWeight: "bold" }}
          color={colors.onSurface}
          overflow="ellipsis"
          maxLines={1}
        >
          {bill.title}
        </Text>

        <Card
          colors={{ containerColor: colors.primary }}
          modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(24))]}
        >
          <Column
            verticalArrangement={{ spacedBy: 12 }}
            modifiers={[fillMaxWidth(), paddingAll(18)]}
          >
            <Row
              verticalAlignment="center"
              horizontalArrangement="spaceBetween"
              modifiers={[fillMaxWidth()]}
            >
              <Text
                style={{
                  typography: "labelMedium",
                  fontWeight: "bold",
                  letterSpacing: 0.5,
                }}
                color={colors.onPrimary}
              >
                {`Total tagihan · ${bill.split_type === "equal" ? "bagi rata" : "per-item"}`}
              </Text>
              <Row
                modifiers={[
                  clip(Shapes.RoundedCorner(999)),
                  background(colors.primaryContainer),
                  padding(10, 4, 10, 4),
                ]}
              >
                <Text
                  style={{ typography: "labelSmall", fontWeight: "bold" }}
                  color={colors.onPrimaryContainer}
                >
                  {`PPN ${bill.tax_percentage}%`}
                </Text>
              </Row>
            </Row>
            <Text
              style={{ typography: "headlineMedium", fontWeight: "bold" }}
              color={colors.onPrimary}
            >
              {formatRupiah(bill.total_amount)}
            </Text>
            <Row
              verticalAlignment="center"
              horizontalArrangement={{ spacedBy: 9 }}
            >
              <LinearProgressIndicator
                progress={total > 0 ? paidCount / total : 0}
                color={colors.onPrimary}
                trackColor={colors.primaryContainer}
                modifiers={[
                  weight(1),
                  height(6),
                  clip(Shapes.RoundedCorner(999)),
                ]}
              />
              <Text
                style={{ typography: "labelSmall", fontWeight: "bold" }}
                color={colors.onPrimary}
              >
                {`${paidCount} / ${total} lunas`}
              </Text>
            </Row>
          </Column>
        </Card>

        {isCreator && unpaidParticipants.length > 0 && (
          <OutlinedButton
            enabled={reminderCooldown === 0 && !reminding}
            onClick={() => handleRemindUnpaid(unpaidParticipants)}
            modifiers={[fillMaxWidth()]}
          >
            <Row
              verticalAlignment="center"
              horizontalArrangement={{ spacedBy: 6 }}
            >
              <Icon
                source={NotificationsActive}
                tint={colors.primary}
                size={16}
              />
              <Text style={{ typography: "labelLarge" }} color={colors.primary}>
                {reminderCooldown > 0
                  ? `Ingatkan lagi dalam ${formatCooldown(reminderCooldown)}`
                  : "Ingatkan yang belum bayar"}
              </Text>
            </Row>
          </OutlinedButton>
        )}

        {offeredMethods.length > 0 && (
          <Column verticalArrangement={{ spacedBy: 7 }}>
            <Text
              style={{
                typography: "labelMedium",
                fontWeight: "bold",
                letterSpacing: 0.5,
              }}
              color={colors.onSurfaceVariant}
            >
              BAYAR KE
            </Text>
            <Row horizontalArrangement={{ spacedBy: 8 }}>
              {offeredMethods.map((pm) => (
                <Row
                  key={pm.id}
                  verticalAlignment="center"
                  horizontalArrangement={{ spacedBy: 6 }}
                  modifiers={[
                    clip(Shapes.RoundedCorner(999)),
                    background(colors.surfaceContainer),
                    padding(12, 7, 12, 7),
                  ]}
                >
                  <Icon
                    source={TYPE_ICON[pm.type] ?? AccountBalance}
                    tint={colors.primary}
                    size={16}
                  />
                  <Text
                    style={{ typography: "labelMedium" }}
                    color={colors.onSurface}
                  >
                    {pm.provider_name}
                  </Text>
                </Row>
              ))}
            </Row>
          </Column>
        )}

        <Column verticalArrangement={{ spacedBy: 10 }}>
          <Text
            style={{
              typography: "labelMedium",
              fontWeight: "bold",
              letterSpacing: 0.5,
            }}
            color={colors.onSurfaceVariant}
          >
            {`PESERTA · ${total} ORANG`}
          </Text>
          {participants.map((p) => {
            const isCustom = p.user_id === null;
            const participantUser =
              p.user_id === currentUser.id
                ? currentUser
                : p.user_id
                  ? usersById.get(p.user_id)
                  : undefined;
            const name =
              p.user_id === currentUser.id
                ? `${currentUser.fullname} (kamu)`
                : isCustom
                  ? (p.display_name ?? "Anggota")
                  : (participantUser?.fullname ?? "Anggota");
            const { bg, fg } = statusColor(p.payment_status, colors);
            const avatarColors = avatarColorFor(p.user_id ?? p.id, colors);

            if (isCreator && p.payment_status === "pending_verification") {
              return (
                <Card
                  key={p.id}
                  colors={{ containerColor: colors.surfaceContainer }}
                  modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(18))]}
                >
                  <Column
                    verticalArrangement={{ spacedBy: 12 }}
                    modifiers={[fillMaxWidth(), paddingAll(14)]}
                  >
                    <Row
                      verticalAlignment="center"
                      horizontalArrangement={{ spacedBy: 12 }}
                    >
                      <Avatar
                        fullname={name}
                        avatarUrl={participantUser?.avatar_url}
                        diameter={44}
                        colors={avatarColors}
                      />
                      <Column
                        verticalArrangement={{ spacedBy: 2 }}
                        modifiers={[weight(1)]}
                      >
                        <Text
                          style={{
                            typography: "bodyMedium",
                            fontWeight: "600",
                          }}
                          color={colors.onSurface}
                        >
                          {name}
                        </Text>
                        <Text
                          style={{ typography: "bodySmall" }}
                          color={colors.onSurfaceVariant}
                        >
                          {formatRupiah(p.amount_due)}
                        </Text>
                      </Column>
                      <Row
                        modifiers={[
                          clip(Shapes.RoundedCorner(999)),
                          background(bg),
                          padding(9, 5, 9, 5),
                        ]}
                      >
                        <Text
                          style={{
                            typography: "labelSmall",
                            fontWeight: "bold",
                          }}
                          color={fg}
                        >
                          {PARTICIPANT_STATUS_LABEL[p.payment_status]}
                        </Text>
                      </Row>
                    </Row>
                    {p.proof_of_payment_url && (
                      <Box
                        contentAlignment="center"
                        modifiers={[
                          fillMaxWidth(),
                          height(220),
                          clip(Shapes.RoundedCorner(12)),
                          background(colors.surfaceContainerHigh),
                        ]}
                      >
                        <RNHostView>
                          <Image
                            source={{ uri: p.proof_of_payment_url }}
                            style={{ width: "100%", height: "100%" }}
                            resizeMode="contain"
                            onLoad={() =>
                              setLoadedProofUrls((prev) =>
                                new Set(prev).add(p.proof_of_payment_url!),
                              )
                            }
                          />
                        </RNHostView>
                        {!loadedProofUrls.has(p.proof_of_payment_url) && (
                          <CircularWavyProgressIndicator
                            color={colors.primary}
                            modifiers={[size(28, 28)]}
                          />
                        )}
                      </Box>
                    )}
                    <Row
                      verticalAlignment="center"
                      horizontalArrangement={{ spacedBy: 9 }}
                    >
                      <OutlinedButton
                        onClick={() => handleVerify(p.id, false)}
                        modifiers={[weight(1)]}
                      >
                        <Row
                          verticalAlignment="center"
                          horizontalArrangement={{ spacedBy: 6 }}
                        >
                          <Icon source={Close} tint={colors.error} size={18} />
                          <Text
                            style={{
                              typography: "labelLarge",
                              fontWeight: "bold",
                            }}
                            color={colors.error}
                          >
                            Tolak
                          </Text>
                        </Row>
                      </OutlinedButton>
                      <Button
                        onClick={() => handleVerify(p.id, true)}
                        modifiers={[weight(1)]}
                      >
                        <Row
                          verticalAlignment="center"
                          horizontalArrangement={{ spacedBy: 6 }}
                        >
                          <Icon
                            source={Check}
                            tint={colors.onPrimary}
                            size={18}
                          />
                          <Text
                            style={{
                              typography: "labelLarge",
                              fontWeight: "bold",
                            }}
                            color={colors.onPrimary}
                          >
                            Konfirmasi
                          </Text>
                        </Row>
                      </Button>
                    </Row>
                  </Column>
                </Card>
              );
            }

            const canConfirmCustom =
              isCreator && isCustom && p.payment_status !== "paid";

            return (
              <Card
                key={p.id}
                colors={{ containerColor: colors.surfaceContainerLow }}
                modifiers={[
                  fillMaxWidth(),
                  clip(Shapes.RoundedCorner(18)),
                  ...(canConfirmCustom
                    ? [clickable(() => setCustomPayTarget(p))]
                    : []),
                ]}
              >
                <Row
                  verticalAlignment="center"
                  horizontalArrangement={{ spacedBy: 12 }}
                  modifiers={[fillMaxWidth(), paddingAll(13)]}
                >
                  <Avatar
                    fullname={name}
                    avatarUrl={participantUser?.avatar_url}
                    diameter={44}
                    colors={avatarColors}
                  />
                  <Column
                    verticalArrangement={{ spacedBy: 2 }}
                    modifiers={[weight(1)]}
                  >
                    <Text
                      style={{ typography: "bodyMedium", fontWeight: "600" }}
                      color={colors.onSurface}
                    >
                      {name}
                    </Text>
                    <Text
                      style={{ typography: "bodySmall" }}
                      color={colors.onSurfaceVariant}
                    >
                      {p.user_id === bill.creator_id
                        ? "Pembuat tagihan"
                        : canConfirmCustom
                          ? `${formatRupiah(p.amount_due)} · ketuk untuk konfirmasi`
                          : formatRupiah(p.amount_due)}
                    </Text>
                  </Column>
                  <Row
                    modifiers={[
                      clip(Shapes.RoundedCorner(999)),
                      background(bg),
                      padding(10, 5, 10, 5),
                    ]}
                  >
                    <Text
                      style={{ typography: "labelSmall", fontWeight: "bold" }}
                      color={fg}
                    >
                      {PARTICIPANT_STATUS_LABEL[p.payment_status]}
                    </Text>
                  </Row>
                </Row>
              </Card>
            );
          })}
        </Column>

        {!isCreator &&
          myRow &&
          (myRow.payment_status === "unpaid" ||
            myRow.payment_status === "rejected") && (
            <Button
              onClick={() => onPay(bill, myRow, offeredMethods)}
              modifiers={[fillMaxWidth()]}
            >
              <Text
                style={{ typography: "labelLarge", fontWeight: "bold" }}
                color={colors.onPrimary}
              >
                Bayar patungan
              </Text>
            </Button>
          )}
      </Column>
    </ModalBottomSheet>
    {customPayTarget && (
      <ConfirmCustomPaymentSheet
        participant={customPayTarget}
        offeredMethods={offeredMethods}
        onClose={() => setCustomPayTarget(null)}
        onConfirmed={() => {
          setCustomPayTarget(null);
          loadData();
        }}
      />
    )}
    </>
  );
}

function ConfirmCustomPaymentSheet({
  participant,
  offeredMethods,
  onClose,
  onConfirmed,
}: {
  participant: SplitBillParticipantRow;
  offeredMethods: PaymentMethodRow[];
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const colors = useMaterialColors();
  const selectableMethods = offeredMethods.filter((m) => m.type !== "qris");
  const [methodId, setMethodId] = useState<string | null>(
    selectableMethods[0]?.id ?? null,
  );
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    if (!methodId) return;
    setConfirming(true);
    try {
      const { error } = await splitBillParticipantsApi.update(participant.id, {
        payment_status: "paid",
        payment_method_id: methodId,
        paid_at: new Date().toISOString(),
      });
      if (error) throw error;
      onConfirmed();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <ModalBottomSheet onDismissRequest={onClose}>
      <Column
        verticalArrangement={{ spacedBy: 16 }}
        modifiers={[
          fillMaxWidth(),
          verticalScroll(),
          padding(24, 8, 24, 32),
        ]}
      >
        <Column verticalArrangement={{ spacedBy: 4 }}>
          <Text
            style={{ typography: "headlineSmall", fontWeight: "bold" }}
            color={colors.onSurface}
          >
            {`Konfirmasi bayar · ${participant.display_name ?? "Anggota"}`}
          </Text>
          <Text
            style={{ typography: "bodyMedium" }}
            color={colors.onSurfaceVariant}
          >
            {`${formatRupiah(participant.amount_due)} · dikonfirmasi olehmu, tanpa bukti transfer`}
          </Text>
        </Column>

        <Column verticalArrangement={{ spacedBy: 9 }}>
          <Text
            style={{ typography: "labelMedium", fontWeight: "bold" }}
            color={colors.onSurface}
          >
            Metode bayar
          </Text>
          {selectableMethods.length === 0 ? (
            <Text
              style={{ typography: "bodyMedium" }}
              color={colors.onSurfaceVariant}
            >
              Tidak ada metode pembayaran yang ditawarkan pada bill ini.
            </Text>
          ) : (
            selectableMethods.map((pm) => (
              <Row
                key={pm.id}
                verticalAlignment="center"
                horizontalArrangement={{ spacedBy: 12 }}
                modifiers={[
                  fillMaxWidth(),
                  clip(Shapes.RoundedCorner(14)),
                  selectable(
                    methodId === pm.id,
                    () => setMethodId(pm.id),
                    "radioButton",
                  ),
                  padding(12, 10, 12, 10),
                ]}
              >
                <Box
                  contentAlignment="center"
                  modifiers={[
                    size(40, 40),
                    clip(Shapes.RoundedCorner(12)),
                    background(colors.secondaryContainer),
                  ]}
                >
                  <Icon
                    source={TYPE_ICON[pm.type] ?? AccountBalance}
                    tint={colors.onSecondaryContainer}
                    size={20}
                  />
                </Box>
                <Column
                  verticalArrangement={{ spacedBy: 2 }}
                  modifiers={[weight(1)]}
                >
                  <Text
                    style={{ typography: "bodyMedium", fontWeight: "600" }}
                    color={colors.onSurface}
                  >
                    {pm.provider_name}
                  </Text>
                  {pm.account_number && (
                    <Text
                      style={{ typography: "labelSmall" }}
                      color={colors.onSurfaceVariant}
                    >
                      {pm.account_number}
                    </Text>
                  )}
                </Column>
                <RadioButton selected={methodId === pm.id} />
              </Row>
            ))
          )}
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
            enabled={!confirming && !!methodId}
            onClick={handleConfirm}
            modifiers={[weight(1)]}
          >
            <ButtonContent
              loading={confirming}
              enabled={!!methodId}
              label="Konfirmasi"
              color={colors.onPrimary}
            />
          </Button>
        </Row>
      </Column>
    </ModalBottomSheet>
  );
}

export function SplitBillPayFormSheet({
  bill: initialBill,
  participant: initialParticipant,
  offeredMethods: initialOfferedMethods,
  onClose,
  onSubmitted,
}: {
  bill: SplitBillRow;
  participant: SplitBillParticipantRow;
  offeredMethods: PaymentMethodRow[];
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const colors = useMaterialColors();
  const [bill, setBill] = useState(initialBill);
  const [participant, setParticipant] = useState(initialParticipant);
  const [offeredMethods, setOfferedMethods] = useState(initialOfferedMethods);
  const [methodId, setMethodId] = useState<string | null>(
    (
      initialOfferedMethods.find((m) => m.type !== "qris") ??
      initialOfferedMethods[0]
    )?.id ?? null,
  );
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loadedHelperQrisUrl, setLoadedHelperQrisUrl] = useState<string | null>(
    null,
  );
  const [loadedProofUrl, setLoadedProofUrl] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await splitBillsApi.getById(initialBill.id);
      const fresh = data as SplitBillDetail | null;
      if (!fresh) return;
      setBill(fresh);
      const freshParticipant = fresh.split_bill_participants.find(
        (p) => p.id === initialParticipant.id,
      );
      if (freshParticipant) setParticipant(freshParticipant);
      const freshMethods = fresh.split_bill_payment_methods.map(
        (spm) => spm.payment_methods,
      );
      setOfferedMethods(freshMethods);
      setMethodId((prev) =>
        freshMethods.some((m) => m.id === prev && m.type !== "qris")
          ? prev
          : ((freshMethods.find((m) => m.type !== "qris") ?? freshMethods[0])
              ?.id ?? null),
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBill.id]);

  const selectedMethod = offeredMethods.find((m) => m.id === methodId);
  const qrisMethod = offeredMethods.find(
    (m) => m.type === "qris" && m.qris_image_url,
  );
  const selectableMethods = offeredMethods.filter((m) => m.type !== "qris");

  const handleCopyAccountNumber = async () => {
    if (!selectedMethod?.account_number) return;
    await Clipboard.setStringAsync(selectedMethod.account_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePickProof = async () => {
    setUploading(true);
    try {
      const url = await pickAndUploadImage(
        "payment-proofs",
        participant.user_id ?? participant.id,
      );
      if (url) setProofUrl(url);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!methodId || !proofUrl) {
      alert("Pilih metode bayar dan lampirkan bukti transfer terlebih dahulu.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await splitBillParticipantsApi.update(participant.id, {
        payment_method_id: methodId,
        proof_of_payment_url: proofUrl,
        payment_status: "pending_verification",
        paid_at: new Date().toISOString(),
      });
      if (error) throw error;
      onSubmitted();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
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
        <Card
          colors={{ containerColor: colors.primaryContainer }}
          modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(20))]}
        >
          <Column
            verticalArrangement={{ spacedBy: 4 }}
            modifiers={[fillMaxWidth(), paddingAll(16)]}
          >
            <Text
              style={{ typography: "labelMedium" }}
              color={colors.onPrimaryContainer}
            >
              {`Bagianmu untuk ${bill.title}`}
            </Text>
            <Text
              style={{ typography: "headlineMedium", fontWeight: "bold" }}
              color={colors.onPrimaryContainer}
            >
              {formatRupiah(participant.amount_due)}
            </Text>
          </Column>
        </Card>

        {qrisMethod?.qris_image_url && (
          <Card
            colors={{ containerColor: colors.surfaceContainer }}
            modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(16))]}
          >
            <Column
              horizontalAlignment="center"
              verticalArrangement={{ spacedBy: 10 }}
              modifiers={[fillMaxWidth(), paddingAll(16)]}
            >
              <Text
                style={{ typography: "labelMedium", fontWeight: "bold" }}
                color={colors.onSurface}
              >
                Scan QRIS ini untuk bayar
              </Text>
              <Box
                contentAlignment="center"
                modifiers={[
                  fillMaxWidth(),
                  height(240),
                  clip(Shapes.RoundedCorner(12)),
                  background(colors.surface),
                  clickable(() => setViewerOpen(true)),
                ]}
              >
                <RNHostView>
                  <Image
                    source={{ uri: qrisMethod.qris_image_url }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="contain"
                    onLoad={() =>
                      setLoadedHelperQrisUrl(qrisMethod.qris_image_url)
                    }
                  />
                </RNHostView>
                {loadedHelperQrisUrl !== qrisMethod.qris_image_url && (
                  <CircularWavyProgressIndicator
                    color={colors.primary}
                    modifiers={[size(32, 32)]}
                  />
                )}
              </Box>
              <Text
                style={{ typography: "bodySmall", textAlign: "center" }}
                color={colors.onSurfaceVariant}
              >
                Ketuk untuk perbesar
              </Text>
            </Column>
          </Card>
        )}

        {selectedMethod && selectedMethod.type !== "qris" && (
          <Card
            colors={{ containerColor: colors.surfaceContainer }}
            modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(16))]}
          >
            <Row
              verticalAlignment="center"
              horizontalArrangement="spaceBetween"
              modifiers={[fillMaxWidth(), paddingAll(14)]}
            >
              <Column verticalArrangement={{ spacedBy: 2 }}>
                <Text
                  style={{ typography: "labelSmall" }}
                  color={colors.onSurfaceVariant}
                >
                  {selectedMethod.type === "bank"
                    ? "Nomor rekening"
                    : "Nomor HP / akun"}
                </Text>
                <Text
                  style={{ typography: "titleMedium", fontWeight: "bold" }}
                  color={colors.onSurface}
                >
                  {selectedMethod.account_number ?? "-"}
                </Text>
              </Column>
              <OutlinedButton onClick={handleCopyAccountNumber}>
                <Row
                  verticalAlignment="center"
                  horizontalArrangement={{ spacedBy: 6 }}
                >
                  <Icon source={ContentCopy} tint={colors.primary} size={16} />
                  <Text
                    style={{ typography: "labelLarge" }}
                    color={colors.primary}
                  >
                    {copied ? "Tersalin" : "Salin"}
                  </Text>
                </Row>
              </OutlinedButton>
            </Row>
          </Card>
        )}

        <Column verticalArrangement={{ spacedBy: 9 }}>
          <Text
            style={{ typography: "labelMedium", fontWeight: "bold" }}
            color={colors.onSurface}
          >
            Pilih metode bayar
          </Text>
          {selectableMethods.map((pm) => (
            <Row
              key={pm.id}
              verticalAlignment="center"
              horizontalArrangement={{ spacedBy: 12 }}
              modifiers={[
                fillMaxWidth(),
                clip(Shapes.RoundedCorner(14)),
                selectable(
                  methodId === pm.id,
                  () => setMethodId(pm.id),
                  "radioButton",
                ),
                padding(12, 10, 12, 10),
              ]}
            >
              <Box
                contentAlignment="center"
                modifiers={[
                  size(40, 40),
                  clip(Shapes.RoundedCorner(12)),
                  background(colors.secondaryContainer),
                ]}
              >
                <Icon
                  source={TYPE_ICON[pm.type] ?? AccountBalance}
                  tint={colors.onSecondaryContainer}
                  size={20}
                />
              </Box>
              <Column
                verticalArrangement={{ spacedBy: 2 }}
                modifiers={[weight(1)]}
              >
                <Text
                  style={{ typography: "bodyMedium", fontWeight: "600" }}
                  color={colors.onSurface}
                >
                  {pm.provider_name}
                </Text>
                {pm.account_number && (
                  <Text
                    style={{ typography: "labelSmall" }}
                    color={colors.onSurfaceVariant}
                  >
                    {pm.account_number}
                  </Text>
                )}
              </Column>
              <RadioButton selected={methodId === pm.id} />
            </Row>
          ))}
        </Column>

        <Column verticalArrangement={{ spacedBy: 8 }}>
          <Text
            style={{ typography: "labelMedium", fontWeight: "bold" }}
            color={colors.onSurface}
          >
            Bukti pembayaran
          </Text>
          <Card
            colors={{ containerColor: colors.surfaceContainerLow }}
            modifiers={[
              fillMaxWidth(),
              clip(Shapes.RoundedCorner(18)),
              clickable(handlePickProof),
            ]}
          >
            <Column
              horizontalAlignment="center"
              verticalArrangement={{ spacedBy: 9 }}
              modifiers={[fillMaxWidth(), padding(22, 22, 22, 22)]}
            >
              {uploading ? (
                <CircularWavyProgressIndicator
                  color={colors.primary}
                  modifiers={[size(28, 28)]}
                />
              ) : proofUrl ? (
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
                        source={{ uri: proofUrl }}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode="contain"
                        onLoad={() => setLoadedProofUrl(proofUrl)}
                      />
                    </RNHostView>
                    {loadedProofUrl !== proofUrl && (
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
                    Bukti terunggah · ketuk untuk ganti
                  </Text>
                </>
              ) : (
                <>
                  <Icon source={AddAPhoto} tint={colors.primary} size={30} />
                  <Text
                    style={{ typography: "bodyMedium", fontWeight: "600" }}
                    color={colors.onSurface}
                  >
                    Unggah bukti transfer
                  </Text>
                  <Text
                    style={{ typography: "labelSmall" }}
                    color={colors.onSurfaceVariant}
                  >
                    Foto / screenshot
                  </Text>
                </>
              )}
            </Column>
          </Card>
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
            enabled={!submitting && !!methodId && !!proofUrl}
            onClick={handleSubmit}
            modifiers={[weight(1)]}
          >
            <ButtonContent
              loading={submitting}
              enabled={!!methodId && !!proofUrl}
              label="Kirim bukti bayar"
              color={colors.onPrimary}
            />
          </Button>
        </Row>
      </Column>
      </ModalBottomSheet>
      <ImageViewerModal
        uri={qrisMethod?.qris_image_url ?? null}
        visible={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </>
  );
}
