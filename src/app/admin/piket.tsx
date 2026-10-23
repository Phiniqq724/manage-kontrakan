import { AppHost, useAppColors } from "@/components/AppHost";
import { Avatar, avatarColorFor } from "@/components/Avatar";
import { BackButton } from "@/components/BackButton";
import { FormField } from "@/components/FormField";
import { FormSheet, SheetActions } from "@/components/FormSheet";
import { ChipRow, EmptyState, IconText, SectionLabel } from "@/components/ListBits";
import { motmApi, piketsApi, usersApi } from "@/services/api";
import {
  averageScore,
  periodLabel,
  periodOf,
  prizeLabel,
  vsAverageLabel,
  type Prize,
} from "@/utils/motm";
import { parseDay, toDateStr } from "@/utils/piket-utils";
import type { Database } from "@/utils/supabase-types";
import { useHideOnScroll } from "@/utils/tab-action";
import FactCheck from "@expo/material-symbols/fact_check.xml";
import Leaderboard from "@expo/material-symbols/leaderboard.xml";
import WorkspacePremium from "@expo/material-symbols/workspace_premium.xml";
import {
  Box,
  Card,
  Column,
  OutlinedButton,
  PullToRefreshBox,
  RNHostView,
  Row,
  Text,
} from "@expo/ui/jetpack-compose";
import {
  background,
  clip,
  fillMaxHeight,
  fillMaxSize,
  fillMaxWidth,
  height,
  padding,
  paddingAll,
  Shapes,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useEffect, useState } from "react";
import { Image } from "react-native";

type PiketRow = Database["public"]["Tables"]["pikets"]["Row"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];
type AwardRow = Database["public"]["Tables"]["motm_awards"]["Row"];
type Score = Database["public"]["Functions"]["member_points"]["Returns"][number];

const BILL_LABEL: Record<string, string> = {
  on_time: "bayar tepat waktu",
  late: "bayar terlambat",
  pending: "pembayaran dicek",
  waiting_payment: "belum bayar",
  rejected: "pembayaran ditolak",
};
const PERIODS = [0, -1, -2].map((o) => periodOf(o));
/** How far back the admin sees submitted piket. */
const RECENT_DAYS = 7;
const recentSince = () => {
  const d = new Date();
  d.setDate(d.getDate() - RECENT_DAYS);
  return toDateStr(d);
};

/**
 * Admin: see the past week's submitted piket (they count right away; reject
 * one with a note and the member can upload again), each member's monthly
 * score and the Member of the Month history.
 */
export default function AdminPiketScreen() {
  const colors = useAppColors();
  const hideOnScroll = useHideOnScroll();
  const [tab, setTab] = useState<"review" | "score">("review");
  const [refreshing, setRefreshing] = useState(false);
  const [queue, setQueue] = useState<PiketRow[]>([]);
  const [users, setUsers] = useState<Record<string, UserRow>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<PiketRow | null>(null);
  const [note, setNote] = useState("");
  const [period, setPeriod] = useState(PERIODS[0]);
  const [scores, setScores] = useState<Score[]>([]);
  const [awards, setAwards] = useState<AwardRow[]>([]);

  async function loadData() {
    const [q, u, a] = await Promise.all([
      piketsApi.getSubmittedSince(recentSince()),
      usersApi.getAll(),
      motmApi.getAll(),
    ]);
    setQueue(q.data ?? []);
    setUsers(Object.fromEntries((u.data ?? []).map((x) => [x.id, x])));
    setAwards(a.data ?? []);
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    motmApi.performance(period).then(({ data }) => setScores(data ?? []));
  }, [period]);

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([
      loadData(),
      motmApi.performance(period).then(({ data }) => setScores(data ?? [])),
    ]).finally(() => setRefreshing(false));
  };

  async function reject(p: PiketRow, reviewNote: string) {
    setBusyId(p.id);
    try {
      const { error } = await piketsApi.update(p.id, {
        status: "rejected",
        review_note: reviewNote.trim() || null,
      });
      if (error) throw error;
      setQueue((prev) => prev.filter((x) => x.id !== p.id));
      setRejecting(null);
      setNote("");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const name = (id: string | null) => users[id ?? ""]?.fullname ?? "-";
  const dayLabel = (day: string) =>
    parseDay(day).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });
  const winnerOf = awards.find((a) => a.period === period)?.user_id;
  const best = scores[0]?.score ?? 0;
  const average = averageScore(scores.map((s) => s.score));

  const renderProof = (p: PiketRow) => {
    const busy = busyId === p.id;
    return (
      <Card
        key={p.id}
        colors={{ containerColor: colors.surfaceContainerLow }}
        modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(20))]}
      >
        <Column verticalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth(), paddingAll(16)]}>
          <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }}>
            <Avatar
              fullname={name(p.assign_to)}
              avatarUrl={users[p.assign_to ?? ""]?.avatar_url}
              diameter={40}
              colors={avatarColorFor(p.assign_to ?? "-", colors)}
            />
            <Column modifiers={[weight(1)]}>
              <Text style={{ typography: "titleMedium", fontWeight: "bold" }} color={colors.onSurface}>
                {name(p.assign_to)}
              </Text>
              <Text style={{ typography: "bodySmall" }} color={colors.onSurfaceVariant}>
                {p.extra ? `${dayLabel(p.day)} · piket tambahan` : dayLabel(p.day)}
              </Text>
            </Column>
          </Row>
          {p.description ? (
            <Text style={{ typography: "bodyMedium" }} color={colors.onSurface}>
              {p.description}
            </Text>
          ) : null}
          {p.docs ? (
            <Box
              modifiers={[
                fillMaxWidth(),
                height(240),
                clip(Shapes.RoundedCorner(16)),
                background(colors.surfaceContainerHighest),
              ]}
            >
              <RNHostView>
                <Image source={{ uri: p.docs }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
              </RNHostView>
            </Box>
          ) : (
            <Text style={{ typography: "bodyMedium" }} color={colors.onSurfaceVariant}>
              Tidak ada foto bukti.
            </Text>
          )}
          <OutlinedButton
            enabled={!busy}
            onClick={() => setRejecting(p)}
            modifiers={[fillMaxWidth(), height(48)]}
          >
            <Text style={{ typography: "labelLarge" }} color={colors.error}>
              Tolak
            </Text>
          </OutlinedButton>
        </Column>
      </Card>
    );
  };

  const renderScore = (s: Score, i: number) => {
    const isMotm = s.user_id === winnerOf;
    // Only someone above the average can be Member of the Month.
    const top = s.score === best && best > average;
    return (
      <Card
        key={s.user_id}
        colors={{ containerColor: top ? colors.primaryContainer : colors.surfaceContainerLow }}
        modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(20))]}
      >
        <Column verticalArrangement={{ spacedBy: 10 }} modifiers={[fillMaxWidth(), paddingAll(16)]}>
          <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }}>
            <Text
              style={{ typography: "titleMedium", fontWeight: "bold" }}
              color={top ? colors.onPrimaryContainer : colors.primary}
            >
              {String(i + 1)}
            </Text>
            <Avatar
              fullname={s.fullname}
              avatarUrl={s.avatar_url}
              diameter={40}
              colors={avatarColorFor(s.user_id, colors)}
            />
            <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[weight(1)]}>
              <Text
                style={{ typography: "titleMedium", fontWeight: "bold" }}
                color={top ? colors.onPrimaryContainer : colors.onSurface}
                maxLines={1}
                overflow="ellipsis"
              >
                {s.fullname}
              </Text>
              <Text
                style={{ typography: "bodySmall" }}
                color={top ? colors.onPrimaryContainer : colors.onSurfaceVariant}
              >
                {`Piket ${s.approved}/${s.assigned}${s.extra ? ` · +${s.extra} tambahan` : ""} · ${BILL_LABEL[s.bill_status ?? ""] ?? "belum ada tagihan"}`}
              </Text>
              <Text
                style={{ typography: "labelMedium", fontWeight: "bold" }}
                color={top ? colors.onPrimaryContainer : s.score < average ? colors.error : colors.primary}
              >
                {vsAverageLabel(s.score, average)}
              </Text>
            </Column>
            <Text
              style={{ typography: "headlineSmall", fontWeight: "bold" }}
              color={top ? colors.onPrimaryContainer : colors.onSurface}
            >
              {String(s.score)}
            </Text>
          </Row>
          <Row
            modifiers={[
              fillMaxWidth(),
              height(6),
              clip(Shapes.RoundedCorner(3)),
              background(colors.surfaceContainerHighest),
            ]}
          >
            {s.score > 0 && (
              <Box modifiers={[weight(s.score), fillMaxHeight(), background(colors.primary)]} />
            )}
            {/* Points have no ceiling, so the bar is relative to the best score. */}
            {s.score < best && <Box modifiers={[weight(best - s.score), fillMaxHeight()]} />}
          </Row>
          {isMotm && (
            <IconText
              icon={WorkspacePremium}
              text="Member of the Month"
              color={top ? colors.onPrimaryContainer : colors.primary}
              bold
            />
          )}
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
          <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 4 }} modifiers={[fillMaxWidth()]}>
            <BackButton />
            <Text style={{ typography: "headlineMedium", fontWeight: "bold" }} color={colors.onBackground}>
              Piket & MOTM
            </Text>
          </Row>

          <ChipRow
            options={[
              ["review", `Piket masuk ${queue.length}`],
              ["score", "Performa"],
            ]}
            value={tab}
            onChange={setTab}
          />

          {tab === "review" ? (
            queue.length === 0 ? (
              <EmptyState icon={FactCheck} text="Belum ada piket seminggu terakhir." />
            ) : (
              <Column verticalArrangement={{ spacedBy: 12 }}>{queue.map(renderProof)}</Column>
            )
          ) : (
            <Column verticalArrangement={{ spacedBy: 12 }}>
              <ChipRow
                options={PERIODS.map((p) => [p, periodLabel(p)] as [string, string])}
                value={period}
                onChange={setPeriod}
              />
              {scores.length === 0 ? (
                <EmptyState icon={Leaderboard} text="Belum ada data bulan ini." />
              ) : (
                scores.map(renderScore)
              )}

              {awards.length > 0 && (
                <Column verticalArrangement={{ spacedBy: 8 }} modifiers={[padding(0, 12, 0, 0)]}>
                  <SectionLabel>RIWAYAT MOTM</SectionLabel>
                  {awards.map((a) => (
                    <Row
                      key={a.id}
                      verticalAlignment="center"
                      horizontalArrangement={{ spacedBy: 12 }}
                      modifiers={[
                        fillMaxWidth(),
                        clip(Shapes.RoundedCorner(16)),
                        background(colors.surfaceContainerLow),
                        paddingAll(12),
                      ]}
                    >
                      <Avatar
                        fullname={name(a.user_id)}
                        avatarUrl={users[a.user_id]?.avatar_url}
                        diameter={36}
                        colors={avatarColorFor(a.user_id, colors)}
                      />
                      <Column modifiers={[weight(1)]}>
                        <Text style={{ typography: "bodyLarge", fontWeight: "bold" }} color={colors.onSurface}>
                          {name(a.user_id)}
                        </Text>
                        <Text style={{ typography: "bodySmall" }} color={colors.onSurfaceVariant}>
                          {`${periodLabel(a.period)} · skor ${a.score}`}
                        </Text>
                      </Column>
                      <Text style={{ typography: "labelLarge", fontWeight: "bold" }} color={colors.primary}>
                        {a.prize && a.prize_amount
                          ? prizeLabel({ prize: a.prize, amount: a.prize_amount } as Prize)
                          : "Belum diambil"}
                      </Text>
                    </Row>
                  ))}
                </Column>
              )}
            </Column>
          )}
        </Column>
      </PullToRefreshBox>

      {rejecting && (
        <FormSheet
          title="Tolak bukti piket"
          subtitle={`${name(rejecting.assign_to)} · ${dayLabel(rejecting.day)}`}
          onClose={() => setRejecting(null)}
        >
          <FormField
            label="Alasan (dikirim ke member)"
            onValueChange={setNote}
            minLines={2}
            keyboardOptions={{ capitalization: "sentences" }}
          />
          <SheetActions
            onCancel={() => setRejecting(null)}
            onSubmit={() => reject(rejecting, note)}
            submitLabel="Tolak"
            destructive
            loading={busyId === rejecting.id}
          />
        </FormSheet>
      )}
    </AppHost>
  );
}
