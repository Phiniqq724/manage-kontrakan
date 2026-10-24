import { haptics } from "@/utils/haptics";
import { AppHost, useAppColors } from "@/components/AppHost";
import { BackButton } from "@/components/BackButton";
import { useHideOnScroll } from "@/utils/tab-action";
import { ButtonContent } from "@/components/ButtonContent";
import { FormSheet, SheetActions } from "@/components/FormSheet";
import {
  formatPaymentPeriod,
  StatusBadge,
  type PaymentRow,
} from "@/components/PaymentsSheets";
import { paymentsApi, usersApi } from "@/services/api";
import { sendPush } from "@/utils/notifications";
import type { Database } from "@/utils/supabase-types";
import {
  Box,
  Button,
  Column,
  HorizontalDivider,
  PullToRefreshBox,
  RNHostView,
  Row,
  Text,
} from "@expo/ui/jetpack-compose";
import {
  background,
  clickable,
  clip,
  fillMaxSize,
  fillMaxWidth,
  height,
  padding,
  Shapes,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useEffect, useState } from "react";
import { Image } from "react-native";

const BILL_AMOUNT = 123000;
const DUE_DAY = 10;

type UserRow = Database["public"]["Tables"]["users"]["Row"];

export default function AdminPaymentsScreen() {
  const hideOnScroll = useHideOnScroll();
  const colors = useAppColors();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [users, setUsers] = useState<Record<string, UserRow>>({});
  const [selected, setSelected] = useState<PaymentRow | null>(null);
  const [processing, setProcessing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [payRes, userRes] = await Promise.all([
      paymentsApi.getAll(),
      usersApi.getAll(),
    ]);
    const userMap: Record<string, UserRow> = {};
    (userRes.data ?? []).forEach((u) => {
      userMap[u.id] = u;
    });
    setUsers(userMap);
    const sorted = (payRes.data ?? []).sort((a, b) =>
      a.status === "pending"
        ? -1
        : b.status === "pending"
          ? 1
          : b.period.localeCompare(a.period),
    );
    setPayments(sorted);
  }

  const onRefresh = () => {
    haptics.refresh();
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  };

  async function handleConfirm(action: "approve" | "reject") {
    if (!selected) return;
    setProcessing(true);
    try {
      let finalStatus = action === "reject" ? "rejected" : "on_time";
      if (action === "approve" && selected.paid_at && selected.due_date) {
        const paidDate = new Date(selected.paid_at);
        const dueDate = new Date(selected.due_date);
        finalStatus = paidDate <= dueDate ? "on_time" : "late";
      }

      const { error } = await paymentsApi.update(selected.id, {
        status: finalStatus,
      });
      if (error) throw error;
      if (action === "approve") haptics.success();
      else haptics.error();

      const payer = selected.paid_by ? users[selected.paid_by] : null;
      if (payer) {
        const period = formatPaymentPeriod(selected.period);
        await sendPush({
          recipients: [payer.id],
          type: "payment",
          title:
            action === "approve"
              ? "Pembayaran Dikonfirmasi"
              : "Pembayaran Ditolak",
          body:
            action === "approve"
              ? finalStatus === "on_time"
                ? `Pembayaran ${period} kamu dikonfirmasi. Tepat waktu!`
                : `Pembayaran ${period} kamu dikonfirmasi. Namun tercatat terlambat.`
              : `Pembayaran ${period} kamu ditolak. Silakan upload ulang bukti transfer.`,
        });
      }

      setSelected(null);
      loadData();
    } catch (err: any) {
      haptics.error();
      alert(err.message);
    } finally {
      setProcessing(false);
    }
  }

  async function handleGenerateBills() {
    try {
      const now = new Date();
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const dueDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(DUE_DAY).padStart(2, "0")}`;
      const billableUsers = Object.values(users).filter(
        (u) => u.role !== "admin",
      );
      const existing = await paymentsApi.getAll();
      const existingPeriods = new Set(
        (existing.data ?? [])
          .filter((p) => p.period === period)
          .map((p) => p.paid_by),
      );

      let created = 0;
      for (const u of billableUsers) {
        if (!existingPeriods.has(u.id)) {
          const { error: createError } = await paymentsApi.create({
            paid_by: u.id,
            period,
            due_date: dueDate,
            amount: BILL_AMOUNT,
            status: "waiting_payment",
          });
          if (createError) throw createError;
          await sendPush({
            recipients: [u.id],
            type: "payment",
            title: "Tagihan Bulan Ini Tersedia",
            body: `Tagihan sewa ${formatPaymentPeriod(period)} sebesar Rp ${BILL_AMOUNT.toLocaleString("id-ID")} sudah tersedia.`,
          });
          created++;
        }
      }
      alert(`${created} tagihan berhasil dibuat untuk periode ${period}.`);
      loadData();
    } catch (err: any) {
      haptics.error();
      alert(err.message);
    }
  }

  const pendingCount = payments.filter((p) => p.status === "pending").length;

  return (
    <AppHost style={{ flex: 1 }}>
      <PullToRefreshBox
        isRefreshing={refreshing}
        onRefresh={onRefresh}
        contentAlignment="topCenter"
        modifiers={[fillMaxSize(), background(colors.background)]}
      >
        <Column
          verticalArrangement={{ spacedBy: 20 }}
          modifiers={[fillMaxSize(), hideOnScroll, padding(16, 56, 16, 120)]}
        >
          <Row
            verticalAlignment="center"
            horizontalArrangement={{ spacedBy: 4 }}
            modifiers={[fillMaxWidth()]}
          >
            <BackButton />
            <Column
              verticalArrangement={{ spacedBy: 2 }}
              modifiers={[weight(1)]}
            >
              <Text
                style={{ typography: "titleLarge", fontWeight: "bold" }}
                color={colors.onBackground}
              >
                Pembayaran
              </Text>
              <Text
                style={{ typography: "bodySmall" }}
                color={colors.onSurfaceVariant}
              >
                Konfirmasi bukti transfer
              </Text>
            </Column>
          </Row>

          <Button onClick={handleGenerateBills} modifiers={[fillMaxWidth()]}>
            <Text
              style={{ typography: "labelLarge", fontWeight: "bold" }}
              color={colors.onPrimary}
            >
              Buat tagihan bulan ini
            </Text>
          </Button>

          <Text
            style={{ typography: "labelLarge", fontWeight: "bold" }}
            color={colors.onSurfaceVariant}
          >
            {`${pendingCount} menunggu konfirmasi`}
          </Text>

          {payments.length === 0 && (
            <Text
              style={{ typography: "bodyMedium" }}
              color={colors.onSurfaceVariant}
            >
              Belum ada tagihan.
            </Text>
          )}

          <Column>
            {payments.map((p, i) => {
              const payer = p.paid_by ? users[p.paid_by] : null;
              return (
                <Column key={p.id}>
                  <Row
                    verticalAlignment="center"
                    horizontalArrangement="spaceBetween"
                    modifiers={[
                      fillMaxWidth(),
                      clickable(() => setSelected(p)),
                      padding(0, 12, 0, 12),
                    ]}
                  >
                    <Column verticalArrangement={{ spacedBy: 2 }}>
                      <Text
                        style={{ typography: "bodyLarge", fontWeight: "600" }}
                        color={colors.onSurface}
                      >
                        {payer?.fullname ?? "Unknown"}
                      </Text>
                      <Text
                        style={{ typography: "bodySmall" }}
                        color={colors.onSurfaceVariant}
                      >
                        {formatPaymentPeriod(p.period)}
                        {p.paid_at
                          ? ` · ${new Date(p.paid_at).toLocaleDateString("id-ID")}`
                          : ""}
                      </Text>
                    </Column>
                    <StatusBadge status={p.status} />
                  </Row>
                  {i < payments.length - 1 && (
                    <HorizontalDivider color={colors.outlineVariant} />
                  )}
                </Column>
              );
            })}
          </Column>
        </Column>
      </PullToRefreshBox>

      {selected && (
        <FormSheet
          title="Konfirmasi pembayaran"
          subtitle={`${users[selected.paid_by ?? ""]?.fullname ?? "Unknown"} · ${formatPaymentPeriod(selected.period)}`}
          onClose={() => setSelected(null)}
        >
          <StatusBadge status={selected.status} />

          <HorizontalDivider color={colors.outlineVariant} />

          {selected.docs ? (
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
                  source={{ uri: selected.docs }}
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
            onCancel={() => handleConfirm("reject")}
            cancelLabel="Tolak"
            destructiveCancel
            onSubmit={() => handleConfirm("approve")}
            submitLabel="Konfirmasi"
            enabled={!processing}
            loading={processing}
          />
        </FormSheet>
      )}
    </AppHost>
  );
}
