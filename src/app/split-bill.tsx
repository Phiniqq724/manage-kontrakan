import {
  CreateSplitBillSheet,
  SplitBillDetailSheet,
  SplitBillPayFormSheet,
  type SplitBillDetail,
  type SplitBillParticipantRow,
} from "@/components/SplitBillSheets";
import { splitBillsApi, usersApi } from "@/services/api";
import { useAuth } from "@/utils/auth-context";
import type { Database } from "@/utils/supabase-types";
import Add from "@expo/material-symbols/add.xml";
import ArrowBack from "@expo/material-symbols/arrow_back.xml";
import History from "@expo/material-symbols/history.xml";
import ReceiptLong from "@expo/material-symbols/receipt_long.xml";
import { Host } from "@expo/ui";
import {
  Box,
  Card,
  Column,
  ExtendedFloatingActionButton,
  Icon,
  IconButton,
  LinearProgressIndicator,
  ModalBottomSheet,
  OutlinedButton,
  OutlinedCard,
  PullToRefreshBox,
  Row,
  Text,
  useMaterialColors,
  type MaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  align,
  background,
  clickable,
  clip,
  fillMaxSize,
  fillMaxWidth,
  height,
  padding,
  paddingAll,
  Shapes,
  size,
  verticalScroll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

type PaymentMethodRow = Database["public"]["Tables"]["payment_methods"]["Row"];
type SplitBillRow = Database["public"]["Tables"]["split_bills"]["Row"];

const SPLIT_TYPE_LABEL: Record<string, string> = {
  equal: "bagi rata",
  dynamic: "per-item",
};

function formatRupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function participantStatusColor(status: string, colors: MaterialColors) {
  switch (status) {
    case "paid":
      return { bg: colors.tertiaryContainer, fg: colors.onTertiaryContainer };
    case "unpaid":
      return { bg: colors.errorContainer, fg: colors.onErrorContainer };
    default:
      return {
        bg: colors.secondaryContainer,
        fg: colors.onSecondaryContainer,
      };
  }
}

const PARTICIPANT_STATUS_LABEL: Record<string, string> = {
  unpaid: "Belum bayar",
  pending_verification: "Diverifikasi",
  paid: "Lunas",
  rejected: "Bukti ditolak",
};

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  const colors = useMaterialColors();
  return (
    <Column
      horizontalAlignment="center"
      verticalArrangement={{ spacedBy: 12 }}
      modifiers={[fillMaxWidth(), padding(8, 24, 8, 24)]}
    >
      <Box
        contentAlignment="center"
        modifiers={[
          size(64, 64),
          clip(Shapes.RoundedCorner(32)),
          background(colors.secondaryContainer),
        ]}
      >
        <Icon
          source={ReceiptLong}
          tint={colors.onSecondaryContainer}
          size={28}
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
          {title}
        </Text>
        <Text
          style={{ typography: "bodySmall", textAlign: "center" }}
          color={colors.onSurfaceVariant}
        >
          {subtitle}
        </Text>
      </Column>
    </Column>
  );
}

function CreatedBillCard({
  bill,
  onClick,
}: {
  bill: SplitBillDetail;
  onClick: () => void;
}) {
  const colors = useMaterialColors();
  const total = bill.split_bill_participants.length;
  const paid = bill.split_bill_participants.filter(
    (p) => p.payment_status === "paid",
  ).length;
  return (
    <Card
      colors={{ containerColor: colors.surfaceContainerLow }}
      modifiers={[
        fillMaxWidth(),
        clip(Shapes.RoundedCorner(20)),
        clickable(onClick),
      ]}
    >
      <Column
        verticalArrangement={{ spacedBy: 13 }}
        modifiers={[fillMaxWidth(), paddingAll(16)]}
      >
        <Row
          verticalAlignment="top"
          horizontalArrangement="spaceBetween"
          modifiers={[fillMaxWidth()]}
        >
          <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[weight(1)]}>
            <Text
              style={{ typography: "titleMedium", fontWeight: "bold" }}
              color={colors.onSurface}
            >
              {bill.title}
            </Text>
            <Text
              style={{ typography: "bodySmall" }}
              color={colors.onSurfaceVariant}
            >
              {`${total} orang · ${SPLIT_TYPE_LABEL[bill.split_type] ?? bill.split_type}`}
            </Text>
          </Column>
          <Row
            modifiers={[
              clip(Shapes.RoundedCorner(999)),
              background(
                paid === total
                  ? colors.tertiaryContainer
                  : colors.secondaryContainer,
              ),
              padding(10, 5, 10, 5),
            ]}
          >
            <Text
              style={{ typography: "labelSmall", fontWeight: "bold" }}
              color={
                paid === total
                  ? colors.onTertiaryContainer
                  : colors.onSecondaryContainer
              }
            >
              {paid === total ? "Lunas" : "Berjalan"}
            </Text>
          </Row>
        </Row>
        <Text
          style={{ typography: "headlineSmall", fontWeight: "bold" }}
          color={colors.onSurface}
        >
          {formatRupiah(bill.total_amount)}
        </Text>
        <Row
          verticalAlignment="center"
          horizontalArrangement={{ spacedBy: 9 }}
          modifiers={[fillMaxWidth()]}
        >
          <LinearProgressIndicator
            progress={total > 0 ? paid / total : 0}
            color={colors.primary}
            trackColor={colors.surfaceContainerHighest}
            modifiers={[weight(1), height(6), clip(Shapes.RoundedCorner(999))]}
          />
          <Text
            style={{ typography: "labelSmall", fontWeight: "bold" }}
            color={colors.onSurfaceVariant}
          >
            {`${paid} / ${total} lunas`}
          </Text>
        </Row>
      </Column>
    </Card>
  );
}

function JoinedBillCard({
  bill,
  currentUserId,
  creatorName,
  onClick,
}: {
  bill: SplitBillDetail;
  currentUserId: string;
  creatorName: string;
  onClick: () => void;
}) {
  const colors = useMaterialColors();
  const mine = bill.split_bill_participants.find(
    (p) => p.user_id === currentUserId,
  );
  if (!mine) return null;
  const { bg, fg } = participantStatusColor(mine.payment_status, colors);
  return (
    <OutlinedCard
      border={{ color: colors.outlineVariant }}
      modifiers={[fillMaxWidth(), clickable(onClick)]}
    >
      <Column
        verticalArrangement={{ spacedBy: 13 }}
        modifiers={[fillMaxWidth(), paddingAll(16)]}
      >
        <Row
          verticalAlignment="top"
          horizontalArrangement="spaceBetween"
          modifiers={[fillMaxWidth()]}
        >
          <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[weight(1)]}>
            <Text
              style={{ typography: "titleMedium", fontWeight: "bold" }}
              color={colors.onSurface}
            >
              {bill.title}
            </Text>
            <Text
              style={{ typography: "bodySmall" }}
              color={colors.onSurfaceVariant}
            >
              {`dari ${creatorName} · ${bill.split_bill_participants.length} orang`}
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
              {PARTICIPANT_STATUS_LABEL[mine.payment_status] ??
                mine.payment_status}
            </Text>
          </Row>
        </Row>
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
          <Text
            style={{ typography: "bodySmall" }}
            color={colors.onSurfaceVariant}
          >
            Bagianmu
          </Text>
          <Text
            style={{ typography: "titleMedium", fontWeight: "bold" }}
            color={colors.onSurface}
          >
            {formatRupiah(mine.amount_due)}
          </Text>
        </Row>
      </Column>
    </OutlinedCard>
  );
}

export default function SplitBillScreen() {
  const { user } = useAuth();
  const colors = useMaterialColors();

  const [bills, setBills] = useState<SplitBillDetail[]>([]);
  const [usersById, setUsersById] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [detailBillId, setDetailBillId] = useState<string | null>(null);
  const [payContext, setPayContext] = useState<{
    bill: SplitBillRow;
    participant: SplitBillParticipantRow;
    offeredMethods: PaymentMethodRow[];
  } | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (user) loadData();
    }, [user?.id]),
  );

  async function loadData() {
    if (!user) return;
    const [billsRes, usersRes] = await Promise.all([
      splitBillsApi.getAll(),
      usersApi.getAll(),
    ]);
    setBills((billsRes.data as SplitBillDetail[] | null) ?? []);
    setUsersById(new Map((usersRes.data ?? []).map((u) => [u.id, u.fullname])));
    setLoading(false);
  }

  const onRefresh = () => {
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  };

  const openDetail = (billId: string) => {
    setHistoryOpen(false);
    setDetailBillId(billId);
  };

  if (!user) return null;

  const created = bills.filter((b) => b.creator_id === user.id);
  const joined = bills.filter(
    (b) =>
      b.creator_id !== user.id &&
      b.split_bill_participants.some((p) => p.user_id === user.id),
  );

  const isCreatedFinished = (bill: SplitBillDetail) => {
    const total = bill.split_bill_participants.length;
    const paid = bill.split_bill_participants.filter(
      (p) => p.payment_status === "paid",
    ).length;
    return total > 0 && paid === total;
  };
  const isJoinedFinished = (bill: SplitBillDetail) =>
    bill.split_bill_participants.find((p) => p.user_id === user.id)
      ?.payment_status === "paid";

  const activeCreated = created.filter((b) => !isCreatedFinished(b));
  const finishedCreated = created.filter(isCreatedFinished);
  const activeJoined = joined.filter((b) => !isJoinedFinished(b));
  const finishedJoined = joined.filter(isJoinedFinished);
  const hasHistory = finishedCreated.length > 0 || finishedJoined.length > 0;

  return (
    <Host style={{ flex: 1 }}>
      <Box modifiers={[fillMaxSize()]}>
        <PullToRefreshBox
          isRefreshing={refreshing}
          onRefresh={onRefresh}
          contentAlignment="topCenter"
          modifiers={[fillMaxSize(), background(colors.background)]}
        >
          <Column
            verticalArrangement={{ spacedBy: 20 }}
            modifiers={[
              fillMaxSize(),
              verticalScroll(),
              padding(16, 56, 16, 100),
            ]}
          >
            <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
              <IconButton onClick={() => router.back()}>
                <Icon source={ArrowBack} tint={colors.onSurface} size={22} />
              </IconButton>
              <Text
                style={{ typography: "titleLarge", fontWeight: "bold" }}
                color={colors.onBackground}
                modifiers={[weight(1)]}
              >
                Split Bill
              </Text>
              <OutlinedButton onClick={() => setHistoryOpen(true)}>
                <Row
                  verticalAlignment="center"
                  horizontalArrangement={{ spacedBy: 6 }}
                >
                  <Icon source={History} tint={colors.primary} size={18} />
                  <Text
                    style={{ typography: "labelLarge" }}
                    color={colors.primary}
                  >
                    Riwayat
                  </Text>
                </Row>
              </OutlinedButton>
            </Row>

            {loading ? (
              <Text
                style={{ typography: "bodyMedium" }}
                color={colors.onSurfaceVariant}
              >
                Memuat...
              </Text>
            ) : (
              <>
                <Column verticalArrangement={{ spacedBy: 10 }}>
                  <Text
                    style={{
                      typography: "labelMedium",
                      fontWeight: "bold",
                      letterSpacing: 0.5,
                    }}
                    color={colors.onSurfaceVariant}
                  >
                    KAMU TAGIH
                  </Text>
                  {activeCreated.length === 0 && (
                    <EmptyState
                      title="Belum ada split bill"
                      subtitle="Bikin patungan buat pesanan bareng lewat tombol + di bawah."
                    />
                  )}
                  {activeCreated.map((bill) => (
                    <CreatedBillCard
                      key={bill.id}
                      bill={bill}
                      onClick={() => openDetail(bill.id)}
                    />
                  ))}
                </Column>

                <Column verticalArrangement={{ spacedBy: 10 }}>
                  <Text
                    style={{
                      typography: "labelMedium",
                      fontWeight: "bold",
                      letterSpacing: 0.5,
                    }}
                    color={colors.onSurfaceVariant}
                  >
                    KAMU IKUT
                  </Text>
                  {activeJoined.length === 0 && (
                    <EmptyState
                      title="Belum ada yang kamu ikuti"
                      subtitle="Split bill dari penghuni lain bakal muncul di sini."
                    />
                  )}
                  {activeJoined.map((bill) => (
                    <JoinedBillCard
                      key={bill.id}
                      bill={bill}
                      currentUserId={user.id}
                      creatorName={
                        usersById.get(bill.creator_id) ?? "Seseorang"
                      }
                      onClick={() => openDetail(bill.id)}
                    />
                  ))}
                </Column>
              </>
            )}
          </Column>
        </PullToRefreshBox>

        <ExtendedFloatingActionButton
          onClick={() => setCreateOpen(true)}
          modifiers={[align("bottomEnd"), padding(0, 0, 20, 24)]}
        >
          <ExtendedFloatingActionButton.Icon>
            <Icon source={Add} size={20} />
          </ExtendedFloatingActionButton.Icon>
          <ExtendedFloatingActionButton.Text>
            <Text style={{ typography: "labelLarge", fontWeight: "bold" }}>
              Buat split bill
            </Text>
          </ExtendedFloatingActionButton.Text>
        </ExtendedFloatingActionButton>
      </Box>

      {historyOpen && (
        <ModalBottomSheet onDismissRequest={() => setHistoryOpen(false)}>
          <Column
            verticalArrangement={{ spacedBy: 16 }}
            modifiers={[
              fillMaxWidth(),
              verticalScroll(),
              padding(24, 8, 24, 32),
            ]}
          >
            <Text
              style={{ typography: "headlineSmall", fontWeight: "bold" }}
              color={colors.onSurface}
            >
              Riwayat split bill
            </Text>

            {!hasHistory ? (
              <Text
                style={{ typography: "bodyMedium" }}
                color={colors.onSurfaceVariant}
              >
                Belum ada split bill yang lunas.
              </Text>
            ) : (
              <>
                {finishedCreated.length > 0 && (
                  <Column verticalArrangement={{ spacedBy: 10 }}>
                    <Text
                      style={{
                        typography: "labelMedium",
                        fontWeight: "bold",
                        letterSpacing: 0.5,
                      }}
                      color={colors.onSurfaceVariant}
                    >
                      KAMU TAGIH
                    </Text>
                    {finishedCreated.map((bill) => (
                      <CreatedBillCard
                        key={bill.id}
                        bill={bill}
                        onClick={() => openDetail(bill.id)}
                      />
                    ))}
                  </Column>
                )}
                {finishedJoined.length > 0 && (
                  <Column verticalArrangement={{ spacedBy: 10 }}>
                    <Text
                      style={{
                        typography: "labelMedium",
                        fontWeight: "bold",
                        letterSpacing: 0.5,
                      }}
                      color={colors.onSurfaceVariant}
                    >
                      KAMU IKUT
                    </Text>
                    {finishedJoined.map((bill) => (
                      <JoinedBillCard
                        key={bill.id}
                        bill={bill}
                        currentUserId={user.id}
                        creatorName={
                          usersById.get(bill.creator_id) ?? "Seseorang"
                        }
                        onClick={() => openDetail(bill.id)}
                      />
                    ))}
                  </Column>
                )}
              </>
            )}
          </Column>
        </ModalBottomSheet>
      )}

      {createOpen && (
        <CreateSplitBillSheet
          userId={user.id}
          userFullname={user.fullname}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            loadData();
          }}
        />
      )}

      {detailBillId && (
        <SplitBillDetailSheet
          billId={detailBillId}
          currentUser={user}
          onClose={() => {
            setDetailBillId(null);
            loadData();
          }}
          onPay={(bill, participant, offeredMethods) => {
            setDetailBillId(null);
            setPayContext({ bill, participant, offeredMethods });
          }}
        />
      )}

      {payContext && (
        <SplitBillPayFormSheet
          bill={payContext.bill}
          participant={payContext.participant}
          offeredMethods={payContext.offeredMethods}
          onClose={() => {
            const billId = payContext.bill.id;
            setPayContext(null);
            setDetailBillId(billId);
          }}
          onSubmitted={() => {
            const billId = payContext.bill.id;
            setPayContext(null);
            setDetailBillId(billId);
            loadData();
          }}
        />
      )}
    </Host>
  );
}
