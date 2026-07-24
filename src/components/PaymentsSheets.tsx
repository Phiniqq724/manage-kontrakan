import { ButtonContent } from "@/components/ButtonContent";
import { ImageViewerModal } from "@/components/ImageViewerModal";
import { paymentMethodsApi, paymentsApi } from "@/services/api";
import { getAdminToken, sendPushNotification } from "@/utils/notifications";
import type { Database } from "@/utils/supabase-types";
import { pickAndUploadImage } from "@/utils/upload";
import ReceiptLong from "@expo/material-symbols/receipt_long.xml";
import {
  Box,
  Button,
  CircularWavyProgressIndicator,
  Column,
  HorizontalDivider,
  Icon,
  ModalBottomSheet,
  OutlinedButton,
  OutlinedCard,
  RNHostView,
  Row,
  Text,
  TextButton,
  useMaterialColors,
  type MaterialColors,
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
  const colors = useMaterialColors();
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
  const colors = useMaterialColors();
  const actionable = payments.find((p) => isPayable(p.status));

  return (
    <ModalBottomSheet onDismissRequest={onClose}>
      <Column
        verticalArrangement={{ spacedBy: 16 }}
        modifiers={[fillMaxWidth(), verticalScroll(), padding(24, 8, 24, 32)]}
      >
        <Text
          style={{ typography: "headlineSmall", fontWeight: "bold" }}
          color={colors.onSurface}
        >
          Tagihan
        </Text>

        {actionable && (
          <Row
            verticalAlignment="center"
            horizontalArrangement="spaceBetween"
            modifiers={[
              fillMaxWidth(),
              clip(Shapes.RoundedCorner(16)),
              background(colors.errorContainer),
              clickable(() => onPay(actionable)),
              padding(16, 14, 16, 14),
            ]}
          >
            <Column verticalArrangement={{ spacedBy: 2 }}>
              <Text
                style={{ typography: "labelMedium", fontWeight: "bold" }}
                color={colors.onErrorContainer}
              >
                {actionable.status === "rejected"
                  ? "Bukti ditolak"
                  : "Tagihan belum dibayar"}
              </Text>
              <Text
                style={{ typography: "bodyMedium" }}
                color={colors.onErrorContainer}
              >
                {formatPaymentPeriod(actionable.period)}
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

        <HorizontalDivider color={colors.outlineVariant} />

        <Text
          style={{ typography: "labelLarge", fontWeight: "bold" }}
          color={colors.onSurfaceVariant}
        >
          {`${payments.length} riwayat pembayaran`}
        </Text>

        {payments.length === 0 && (
          <Text
            style={{ typography: "bodyMedium" }}
            color={colors.onSurfaceVariant}
          >
            Belum ada riwayat pembayaran.
          </Text>
        )}

        <Column>
          {payments.map((p, i) => (
            <Column key={p.id}>
              <Row
                verticalAlignment="center"
                horizontalArrangement="spaceBetween"
                modifiers={[
                  fillMaxWidth(),
                  clickable(() => onSelect(p)),
                  padding(0, 12, 0, 12),
                ]}
              >
                <Column verticalArrangement={{ spacedBy: 2 }}>
                  <Text
                    style={{ typography: "bodyLarge", fontWeight: "600" }}
                    color={colors.onSurface}
                  >
                    {formatPaymentPeriod(p.period)}
                  </Text>
                  <Text
                    style={{ typography: "bodySmall" }}
                    color={colors.onSurfaceVariant}
                  >
                    {(p.status === "on_time" || p.status === "late") &&
                    p.paid_at
                      ? `Dikonfirmasi · ${new Date(p.paid_at).toLocaleDateString("id-ID")}`
                      : p.status === "pending"
                        ? "Menunggu konfirmasi admin"
                        : p.status === "rejected"
                          ? "Bukti ditolak, perlu upload ulang"
                          : "Tagihan belum dibayar"}
                  </Text>
                </Column>
                <StatusBadge status={p.status} />
              </Row>
              {i < payments.length - 1 && (
                <HorizontalDivider color={colors.outlineVariant} />
              )}
            </Column>
          ))}
        </Column>
      </Column>
    </ModalBottomSheet>
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
  const colors = useMaterialColors();

  return (
    <ModalBottomSheet onDismissRequest={onClose}>
      <Column
        verticalArrangement={{ spacedBy: 16 }}
        modifiers={[fillMaxWidth(), verticalScroll(), padding(24, 8, 24, 32)]}
      >
        <Column verticalArrangement={{ spacedBy: 4 }}>
          <Text
            style={{ typography: "headlineSmall", fontWeight: "bold" }}
            color={colors.onSurface}
          >
            Detail pembayaran
          </Text>
          <Text
            style={{ typography: "bodyMedium" }}
            color={colors.onSurfaceVariant}
          >
            {formatPaymentPeriod(payment.period)}
          </Text>
        </Column>

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

        <Row
          verticalAlignment="center"
          horizontalArrangement={{ spacedBy: 12 }}
          modifiers={[fillMaxWidth()]}
        >
          <TextButton onClick={onClose} modifiers={[weight(1)]}>
            <Text
              style={{ typography: "labelLarge" }}
              color={colors.onSurfaceVariant}
            >
              Tutup
            </Text>
          </TextButton>
          {isPayable(payment.status) && (
            <Button onClick={() => onPay(payment)} modifiers={[weight(1)]}>
              <Text
                style={{ typography: "labelLarge", fontWeight: "bold" }}
                color={colors.onPrimary}
              >
                {payment.status === "rejected" ? "Upload ulang" : "Bayar"}
              </Text>
            </Button>
          )}
        </Row>
      </Column>
    </ModalBottomSheet>
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
  const colors = useMaterialColors();
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
      onSubmitted();
      const adminToken = await getAdminToken();
      if (adminToken) {
        await sendPushNotification(
          adminToken,
          "Bukti Pembayaran Baru",
          `${userFullname} mengirimkan bukti pembayaran ${formatPaymentPeriod(payment.period)}.`,
        );
      }
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
        <Column key="header" verticalArrangement={{ spacedBy: 4 }}>
          <Text
            style={{ typography: "headlineSmall", fontWeight: "bold" }}
            color={colors.onSurface}
          >
            Input pembayaran
          </Text>
          <Text
            style={{ typography: "bodyMedium" }}
            color={colors.onSurfaceVariant}
          >
            {formatPaymentPeriod(payment.period)}
          </Text>
        </Column>

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

        <Row
          key="actions"
          verticalAlignment="center"
          horizontalArrangement={{ spacedBy: 12 }}
          modifiers={[fillMaxWidth()]}
        >
          <OutlinedButton onClick={onClose} modifiers={[weight(1)]}>
            <Text
              style={{ typography: "labelLarge" }}
              color={colors.onSurfaceVariant}
            >
              Batal
            </Text>
          </OutlinedButton>
          <Button
            enabled={!submitting && !!docsUrl}
            onClick={handleSubmit}
            modifiers={[weight(1)]}
          >
            <ButtonContent
              loading={submitting}
              enabled={!!docsUrl}
              label="Kirim bukti"
              color={colors.onPrimary}
            />
          </Button>
        </Row>
      </Column>
      </ModalBottomSheet>
      <ImageViewerModal
        uri={adminQris}
        visible={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </>
  );
}
