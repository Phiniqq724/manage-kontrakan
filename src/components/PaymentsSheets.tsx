import { haptics } from "@/utils/haptics";
import { useAppColors } from "@/components/AppHost";
import { ButtonContent } from "@/components/ButtonContent";
import { FormSheet, SheetActions } from "@/components/FormSheet";
import { ImageViewerModal } from "@/components/ImageViewerModal";
import { paymentMethodsApi, paymentsApi } from "@/services/api";
import { sendPush } from "@/utils/notifications";
import type { Database } from "@/utils/supabase-types";
import { pickAndUploadImage } from "@/utils/upload";
import CheckCircle from "@expo/material-symbols/check_circle.xml";
import ChevronRight from "@expo/material-symbols/chevron_right.xml";
import ErrorIcon from "@expo/material-symbols/error.xml";
// Filled flame (the package only ships outlined icons).
import LocalFireDepartment from "../assets/icons/local_fire_department_rounded_fill.xml";
import ReceiptLong from "@expo/material-symbols/receipt_long.xml";
import Schedule from "@expo/material-symbols/schedule.xml";
import { formatRupiah, onTimeStreak } from "@/utils/payments";
import {
  Box,
  Button,
  CircularWavyProgressIndicator,
  Column,
  HorizontalDivider,
  Icon,
  OutlinedCard,
  RNHostView,
  Row,
  Text,
  type MaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  background,
  clickable,
  clip,
  fillMaxWidth,
  height,
  padding,
  Shapes,
  size,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useEffect, useState } from "react";
import { Image } from "react-native";

export type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  on_time: "Tepat waktu",
  late: "Terlambat",
  pending: "Menunggu konfirmasi",
  rejected: "Bukti ditolak",
  waiting_payment: "Belum dibayar",
};

export function paymentStatusColor(status: string, colors: MaterialColors) {
  switch (status) {
    case "on_time":
      return { bg: colors.tertiaryContainer, fg: colors.onTertiaryContainer };
    case "rejected":
    case "waiting_payment":
      return { bg: colors.errorContainer, fg: colors.onErrorContainer };
    default:
      return {
        bg: colors.secondaryContainer,
        fg: colors.onSecondaryContainer,
      };
  }
}

export function formatPaymentPeriod(period: string) {
  const d = new Date(`${period}-01`);
  return d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

export function isPayable(status: string) {
  return status === "waiting_payment" || status === "rejected";
}

export function StatusBadge({ status }: { status: string }) {
  const colors = useAppColors();
  const { bg, fg } = paymentStatusColor(status, colors);
  return (
    <Row
      modifiers={[
        clip(Shapes.RoundedCorner(8)),
        background(bg),
        padding(8, 4, 8, 4),
      ]}
    >
      <Text style={{ typography: "labelSmall", fontWeight: "bold" }} color={fg}>
        {PAYMENT_STATUS_LABEL[status] ?? status}
      </Text>
    </Row>
  );
}

/** Icon and tint for a payment's state in the history list. */
const statusLook = (status: string, colors: MaterialColors) => {
  switch (status) {
    case "on_time":
      return { icon: CheckCircle, bg: colors.tertiaryContainer, fg: colors.onTertiaryContainer };
    case "late":
    case "pending":
      return { icon: Schedule, bg: colors.secondaryContainer, fg: colors.onSecondaryContainer };
    default:
      return { icon: ErrorIcon, bg: colors.errorContainer, fg: colors.onErrorContainer };
  }
};

/** One number with a label, for the summary row on top of the history. */
const Stat = ({
  icon,
  value,
  label,
  tint,
}: {
  icon?: number;
  value: string;
  label: string;
  tint: string;
}) => {
  const colors = useAppColors();
  return (
    <Column
      verticalArrangement={{ spacedBy: 2 }}
      modifiers={[
        weight(1),
        clip(Shapes.RoundedCorner(16)),
        background(colors.surfaceContainerHigh),
        padding(14, 12, 14, 12),
      ]}
    >
      <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 4 }}>
        {icon ? <Icon source={icon} tint={tint} size={20} /> : null}
        <Text style={{ typography: "titleLarge", fontWeight: "bold" }} color={colors.onSurface}>
          {value}
        </Text>
      </Row>
      <Text style={{ typography: "labelSmall" }} color={colors.onSurfaceVariant}>
        {label}
      </Text>
    </Column>
  );
};

export function PaymentsListSheet({
  payments,
  onClose,
  onSelect,
  onPay,
}: {
  payments: PaymentRow[];
  onClose: () => void;
  onSelect: (payment: PaymentRow) => void;
  onPay: (payment: PaymentRow) => void;
}) {
  const colors = useAppColors();
  const actionable = payments.find((p) => isPayable(p.status));
  const currentPeriod = new Date().toISOString().slice(0, 7);
  const streak = onTimeStreak(payments, currentPeriod);
  const onTime = payments.filter((p) => p.status === "on_time").length;
  const late = payments.filter((p) => p.status === "late").length;

  return (
    <FormSheet title="Tagihan" subtitle="Riwayat pembayaranmu" onClose={onClose}>
      {payments.length > 0 && (
        <Row horizontalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
          <Stat icon={LocalFireDepartment} value={String(streak)} label="Streak" tint={colors.tertiary} />
          <Stat value={String(onTime)} label="Tepat waktu" tint={colors.primary} />
          <Stat value={String(late)} label="Terlambat" tint={colors.secondary} />
        </Row>
      )}

      {actionable && (
        <Row
          verticalAlignment="center"
          horizontalArrangement={{ spacedBy: 12 }}
          modifiers={[
            fillMaxWidth(),
            clip(Shapes.RoundedCorner(16)),
            background(colors.errorContainer),
            clickable(() => onPay(actionable)),
            padding(16, 12, 12, 12),
          ]}
        >
          <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[weight(1)]}>
            <Text
              style={{ typography: "labelMedium", fontWeight: "bold" }}
              color={colors.onErrorContainer}
            >
              {actionable.status === "rejected" ? "Bukti ditolak" : "Belum dibayar"}
            </Text>
            <Text style={{ typography: "bodyMedium" }} color={colors.onErrorContainer}>
              {`${formatPaymentPeriod(actionable.period)}${actionable.amount != null ? ` · ${formatRupiah(actionable.amount)}` : ""}`}
            </Text>
          </Column>
          <Button
            onClick={() => onPay(actionable)}
            colors={{
              containerColor: colors.onErrorContainer,
              contentColor: colors.errorContainer,
            }}
          >
            <Text
              style={{ typography: "labelLarge", fontWeight: "bold" }}
              color={colors.errorContainer}
            >
              {actionable.status === "rejected" ? "Upload ulang" : "Bayar"}
            </Text>
          </Button>
        </Row>
      )}

      {payments.length === 0 ? (
        <Text style={{ typography: "bodyMedium" }} color={colors.onSurfaceVariant}>
          Belum ada riwayat pembayaran.
        </Text>
      ) : (
        <Column verticalArrangement={{ spacedBy: 4 }}>
          {payments.map((p) => {
            const look = statusLook(p.status, colors);
            const when =
              (p.status === "on_time" || p.status === "late") && p.paid_at
                ? `Dibayar ${new Date(p.paid_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}`
                : PAYMENT_STATUS_LABEL[p.status] ?? p.status;
            return (
              <Row
                key={p.id}
                verticalAlignment="center"
                horizontalArrangement={{ spacedBy: 12 }}
                modifiers={[
                  fillMaxWidth(),
                  clip(Shapes.RoundedCorner(16)),
                  clickable(() => onSelect(p)),
                  padding(4, 8, 0, 8),
                ]}
              >
                <Box
                  contentAlignment="center"
                  modifiers={[size(40, 40), clip(Shapes.Circle), background(look.bg)]}
                >
                  <Icon source={look.icon} tint={look.fg} size={20} />
                </Box>
                <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[weight(1)]}>
                  <Text
                    style={{ typography: "bodyLarge", fontWeight: "bold" }}
                    color={colors.onSurface}
                  >
                    {formatPaymentPeriod(p.period)}
                  </Text>
                  <Text style={{ typography: "bodySmall" }} color={colors.onSurfaceVariant}>
                    {p.amount != null ? `${formatRupiah(p.amount)} · ${when}` : when}
                  </Text>
                </Column>
                <Icon source={ChevronRight} tint={colors.onSurfaceVariant} size={20} />
              </Row>
            );
          })}
        </Column>
      )}
    </FormSheet>
  );
}

export function PaymentDetailSheet({
  payment,
  onClose,
  onPay,
}: {
  payment: PaymentRow;
  onClose: () => void;
  onPay: (payment: PaymentRow) => void;
}) {
  const colors = useAppColors();

  return (
    <FormSheet
      title="Detail pembayaran"
      subtitle={formatPaymentPeriod(payment.period)}
      onClose={onClose}
    >
      <StatusBadge status={payment.status} />

      <HorizontalDivider color={colors.outlineVariant} />

      {payment.docs ? (
        <Box
          modifiers={[
            fillMaxWidth(),
            height(220),
            clip(Shapes.RoundedCorner(12)),
            background(colors.surfaceContainerHighest),
          ]}
        >
          <RNHostView>
            <Image
              source={{ uri: payment.docs }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="contain"
            />
          </RNHostView>
        </Box>
      ) : (
        <Text
          style={{ typography: "bodyMedium" }}
          color={colors.onSurfaceVariant}
        >
          Tidak ada bukti terlampir.
        </Text>
      )}

      <SheetActions
        onCancel={onClose}
        cancelLabel="Tutup"
        onSubmit={isPayable(payment.status) ? () => onPay(payment) : undefined}
        submitLabel={payment.status === "rejected" ? "Upload ulang" : "Bayar"}
      />
    </FormSheet>
  );
}

export function PayFormSheet({
  payment,
  userId,
  userFullname,
  onClose,
  onSubmitted,
}: {
  payment: PaymentRow;
  userId: string;
  userFullname: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const colors = useAppColors();
  const [docsUrl, setDocsUrl] = useState<string | null>(null);
  const [loadedDocsUrl, setLoadedDocsUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [adminQris, setAdminQris] = useState<string | null>(null);
  const [adminQrisLoaded, setAdminQrisLoaded] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
    paymentMethodsApi.getAdminQris().then(setAdminQris);
  }, []);

  const handlePickProof = async () => {
    setUploading(true);
    try {
      const url = await pickAndUploadImage("payment-proofs", userId);
      if (url) setDocsUrl(url);
    } catch (err: any) {
      haptics.error();
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!docsUrl) {
      alert("Lampirkan bukti transfer terlebih dahulu.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await paymentsApi.update(payment.id, {
        status: "pending",
        docs: docsUrl,
        paid_at: new Date().toISOString(),
      });
      if (error) throw error;
      haptics.success();
      onSubmitted();
      await sendPush({
        recipients: "admin",
        type: "payment",
        title: "Bukti Pembayaran Baru",
        body: `${userFullname} mengirimkan bukti pembayaran ${formatPaymentPeriod(payment.period)}.`,
      });
    } catch (err: any) {
      haptics.error();
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <FormSheet
        title="Input pembayaran"
        subtitle={formatPaymentPeriod(payment.period)}
        onClose={onClose}
      >
        {adminQris && (
        <Column
          key="qris"
          horizontalAlignment="center"
          verticalArrangement={{ spacedBy: 8 }}
          modifiers={[
            fillMaxWidth(),
            clip(Shapes.RoundedCorner(16)),
            background(colors.surfaceContainerLow),
            padding(16, 16, 16, 20),
          ]}
        >
          <Text
            style={{ typography: "labelMedium", fontWeight: "bold" }}
            color={colors.onSurface}
          >
            Scan QRIS untuk membayar
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
                source={{ uri: adminQris }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
                onLoad={() => setAdminQrisLoaded(true)}
              />
            </RNHostView>
            {!adminQrisLoaded && (
              <CircularWavyProgressIndicator
                color={colors.primary}
                modifiers={[size(28, 28)]}
              />
            )}
          </Box>
          <Text
            style={{ typography: "bodySmall", textAlign: "center" }}
            color={colors.onSurfaceVariant}
          >
            Ketuk QRIS untuk perbesar, lalu unggah bukti transfernya di bawah.
          </Text>
        </Column>
      )}

      <OutlinedCard
        key="upload"
        border={{ width: 2, color: colors.outline }}
        colors={{ containerColor: colors.surfaceContainerLow }}
        modifiers={[fillMaxWidth(), clickable(handlePickProof)]}
      >
        <Column
          horizontalAlignment="center"
          verticalArrangement={{ spacedBy: 12 }}
          modifiers={[fillMaxWidth(), padding(16, 20, 16, 20)]}
        >
          {uploading ? (
            <CircularWavyProgressIndicator
              color={colors.primary}
              modifiers={[size(32, 32)]}
            />
          ) : docsUrl ? (
            <>
              <Box
                contentAlignment="center"
                modifiers={[
                  fillMaxWidth(),
                  height(220),
                  clip(Shapes.RoundedCorner(12)),
                  background(colors.surfaceContainerHighest),
                ]}
              >
                <RNHostView>
                  <Image
                    source={{ uri: docsUrl }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="contain"
                    onLoad={() => setLoadedDocsUrl(docsUrl)}
                  />
                </RNHostView>
                {loadedDocsUrl !== docsUrl && (
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
              <Icon source={ReceiptLong} tint={colors.primary} size={40} />
              <Text
                style={{ typography: "bodyMedium", fontWeight: "600" }}
                color={colors.onSurface}
              >
                Unggah bukti transfer
              </Text>
              <Text
                style={{ typography: "bodySmall", textAlign: "center" }}
                color={colors.onSurfaceVariant}
              >
                Ketuk untuk pilih tangkapan layar transfer
              </Text>
            </>
          )}
        </Column>
      </OutlinedCard>

      <Text
        key="note"
        style={{ typography: "bodySmall" }}
        color={colors.onSurfaceVariant}
      >
        Bukti akan diverifikasi oleh admin dalam 1×24 jam.
      </Text>

      <SheetActions
        onCancel={onClose}
        onSubmit={handleSubmit}
        submitLabel="Kirim bukti"
        enabled={!!docsUrl}
        loading={submitting}
      />
      </FormSheet>
      <ImageViewerModal
        uri={adminQris}
        visible={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </>
  );
}
