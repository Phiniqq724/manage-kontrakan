import { useAppColors } from "@/components/AppHost";
import { formatPaymentPeriod, isPayable, type PaymentRow } from "@/components/PaymentsSheets";
import { haptics } from "@/utils/haptics";
import { dueProgress, formatRupiah, onTimeStreak, recentMonths } from "@/utils/payments";
// Filled flame (the package only ships outlined icons).
import LocalFireDepartment from "../assets/icons/local_fire_department_rounded_fill.xml";
import {
  Box,
  Button,
  Card,
  Column,
  Icon,
  LinearProgressIndicator,
  Row,
  Text,
} from "@expo/ui/jetpack-compose";
import {
  background,
  clickable,
  clip,
  fillMaxWidth,
  height,
  padding,
  paddingAll,
  Shapes,
  size,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";

/** `#RRGGBB` + alpha byte, e.g. a translucent onPrimary over the card. */
const withAlpha = (hex: string, alphaHex: string) => `${hex.slice(0, 7)}${alphaHex}`;

/** Date-only due dates ("2026-10-29") parse as-is; timestamps without a zone are UTC. */
const parseDue = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s) : new Date(s.endsWith("Z") ? s : `${s}Z`);

const shortMonth = (period: string) =>
  new Date(`${period}-01T00:00:00`).toLocaleDateString("id-ID", { month: "short" });

/**
 * Beranda's bill card: this month's amount and state, a bar running to the
 * due date, the on-time streak (fire) and a Bibit-style streak track of the
 * last 5 months. The
 * whole card opens the payment history.
 */
export const BillCard = ({
  payments,
  currentPeriod,
  onOpenHistory,
  onPay,
}: {
  payments: PaymentRow[];
  currentPeriod: string;
  onOpenHistory: () => void;
  onPay: (payment: PaymentRow) => void;
}) => {
  const colors = useAppColors();
  const on = colors.onPrimary;
  const soft = withAlpha(on, "CC");
  const payment = payments.find((p) => p.period === currentPeriod) ?? null;
  const payable = !!payment && isPayable(payment.status);
  const streak = onTimeStreak(payments, currentPeriod);
  const months = recentMonths(payments, currentPeriod, 5);
  const due = payment?.due_date ? parseDue(payment.due_date) : null;
  const daysLeft = due ? Math.ceil((due.getTime() - Date.now()) / 86400000) : null;

  const headline =
    !payment || payment.amount == null
      ? "Belum ada tagihan"
      : payable
        ? formatRupiah(payment.amount)
        : payment.status === "pending"
          ? "Lagi dicek"
          : "Lunas";
  const subline = !payment
    ? null
    : payable
      ? payment.status === "rejected"
        ? "Bukti ditolak, upload ulang"
        : null
      : payment.status === "pending"
        ? `${formatRupiah(payment.amount ?? 0)} · bukti sedang dicek admin`
        : `${formatRupiah(payment.amount ?? 0)} · ${payment.status === "late" ? "terlambat" : "tepat waktu"}`;

  const band = withAlpha(on, "2E");
  /**
   * One month on the streak track: a lit flame when paid on time, a faded
   * one when late, an empty circle when missed or unpaid, and a dim flame for
   * the current month while it's still open.
   */
  const monthLook = (status: string | null, isNow: boolean) => {
    const halo = withAlpha(on, "26");
    switch (status) {
      case "on_time":
        return { halo, fill: on, flame: colors.primary };
      case "late":
        return { halo, fill: withAlpha(on, "66"), flame: withAlpha(colors.primary, "99") };
      case "waiting_payment":
      case "rejected":
        return isNow
          ? { halo, fill: withAlpha(on, "33"), flame: withAlpha(on, "99") }
          : { halo, fill: colors.errorContainer, flame: null };
      case "pending":
        return { halo, fill: withAlpha(on, "4D"), flame: on };
      default:
        return { halo: "transparent", fill: withAlpha(on, "1F"), flame: null };
    }
  };

  return (
    <Card
      colors={{ containerColor: colors.primary }}
      modifiers={[
        fillMaxWidth(),
        clip(Shapes.RoundedCorner(28)),
        clickable(() => {
          haptics.tick();
          onOpenHistory();
        }),
      ]}
    >
      <Column verticalArrangement={{ spacedBy: 16 }} modifiers={[fillMaxWidth(), paddingAll(20)]}>
        {/* Month on the left, the on-time streak on the right */}
        <Row verticalAlignment="top" modifiers={[fillMaxWidth()]}>
          <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[weight(1)]}>
            <Text
              style={{ typography: "labelMedium", fontWeight: "bold", letterSpacing: 1 }}
              color={soft}
            >
              TAGIHAN
            </Text>
            <Text style={{ typography: "titleMedium", fontWeight: "bold" }} color={on}>
              {formatPaymentPeriod(currentPeriod)}
            </Text>
          </Column>
          {streak > 0 ? (
            <Row
              verticalAlignment="center"
              horizontalArrangement={{ spacedBy: 4 }}
              modifiers={[
                clip(Shapes.RoundedCorner(16)),
                background(withAlpha(on, "26")),
                padding(10, 6, 12, 6),
              ]}
            >
              <Icon source={LocalFireDepartment} tint={colors.tertiaryContainer} size={20} />
              <Text style={{ typography: "titleMedium", fontWeight: "bold" }} color={on}>
                {String(streak)}
              </Text>
              <Text style={{ typography: "labelSmall" }} color={soft}>
                bln
              </Text>
            </Row>
          ) : null}
        </Row>

        <Column verticalArrangement={{ spacedBy: 4 }}>
          <Text style={{ typography: "displaySmall", fontWeight: "bold" }} color={on}>
            {headline}
          </Text>
          {subline ? (
            <Text style={{ typography: "bodyMedium" }} color={soft}>
              {subline}
            </Text>
          ) : null}
        </Column>

        {/* Countdown bar to the due date while it's still to pay */}
        {payable && due && payment ? (
          <Column verticalArrangement={{ spacedBy: 6 }}>
            <LinearProgressIndicator
              progress={dueProgress(payment.period, payment.due_date!, new Date())}
              color={daysLeft !== null && daysLeft <= 2 ? colors.errorContainer : on}
              trackColor={withAlpha(on, "33")}
              modifiers={[fillMaxWidth()]}
            />
            <Row modifiers={[fillMaxWidth()]}>
              <Text style={{ typography: "labelMedium" }} color={soft} modifiers={[weight(1)]}>
                {`Jatuh tempo ${due.toLocaleDateString("id-ID", { day: "numeric", month: "short" })}`}
              </Text>
              <Text style={{ typography: "labelMedium", fontWeight: "bold" }} color={on}>
                {daysLeft === null
                  ? ""
                  : daysLeft < 0
                    ? "Lewat jatuh tempo"
                    : daysLeft === 0
                      ? "Hari ini"
                      : `${daysLeft} hari lagi`}
              </Text>
            </Row>
          </Column>
        ) : null}

        {/* Streak track, Bibit-style: a flame per month paid on time, joined by
            a band while the streak runs unbroken. */}
        <Row modifiers={[fillMaxWidth()]}>
          {months.map((m, i) => {
            const lit = m.status === "on_time";
            const joinLeft = lit && months[i - 1]?.status === "on_time";
            const joinRight = lit && months[i + 1]?.status === "on_time";
            const isNow = m.period === currentPeriod;
            const look = monthLook(m.status, isNow);
            return (
              <Column
                key={m.period}
                horizontalAlignment="center"
                verticalArrangement={{ spacedBy: 6 }}
                modifiers={[weight(1)]}
              >
                <Box contentAlignment="center" modifiers={[fillMaxWidth(), height(44)]}>
                  {/* Band halves reach the cell edges, so neighbours connect. */}
                  <Row modifiers={[fillMaxWidth(), height(26)]}>
                    <Box
                      modifiers={[
                        weight(1),
                        height(26),
                        background(joinLeft ? band : "transparent"),
                      ]}
                    />
                    <Box
                      modifiers={[
                        weight(1),
                        height(26),
                        background(joinRight ? band : "transparent"),
                      ]}
                    />
                  </Row>
                  <Box
                    contentAlignment="center"
                    modifiers={[size(44, 44), clip(Shapes.Circle), background(look.halo)]}
                  >
                    <Box
                      contentAlignment="center"
                      modifiers={[size(32, 32), clip(Shapes.Circle), background(look.fill)]}
                    >
                      {look.flame ? (
                        <Icon source={LocalFireDepartment} tint={look.flame} size={18} />
                      ) : null}
                    </Box>
                  </Box>
                </Box>
                <Text
                  style={{ typography: "labelSmall", fontWeight: isNow ? "bold" : undefined }}
                  color={isNow ? on : soft}
                >
                  {shortMonth(m.period)}
                </Text>
              </Column>
            );
          })}
        </Row>

        {payable && payment ? (
          <Button
            onClick={() => onPay(payment)}
            colors={{ containerColor: on, contentColor: colors.primary }}
            modifiers={[fillMaxWidth()]}
          >
            <Text style={{ typography: "labelLarge", fontWeight: "bold" }} color={colors.primary}>
              {payment.status === "rejected" ? "Upload ulang" : "Bayar sekarang"}
            </Text>
          </Button>
        ) : null}
      </Column>
    </Card>
  );
};
