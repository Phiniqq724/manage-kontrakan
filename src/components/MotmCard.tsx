import { haptics } from "@/utils/haptics";
import { useAppColors } from "@/components/AppHost";
import { Avatar, avatarColorFor } from "@/components/Avatar";
import { ButtonContent } from "@/components/ButtonContent";
import { motmApi, usersApi } from "@/services/api";
import {
  periodLabel,
  periodOf,
  prizeLabel,
  prizeTier,
  TIER_HINT,
  type Prize,
  type PrizeTier,
} from "@/utils/motm";
import type { Database } from "@/utils/supabase-types";
import WorkspacePremium from "@expo/material-symbols/workspace_premium.xml";
import { Button, Card, Column, Icon, Row, Text } from "@expo/ui/jetpack-compose";
import {
  clip,
  fillMaxWidth,
  height,
  paddingAll,
  Shapes,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useEffect, useState } from "react";

type AwardRow = Database["public"]["Tables"]["motm_awards"]["Row"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];

/**
 * Beranda card for last month's Member of the Month, shown to everyone during
 * the following month. The winner gets an "Ambil hadiah" button; the drawn
 * prize (and the winner's gacha tier) is handed to `onWon` so the page can
 * play the gacha.
 */
export const MotmCard = ({
  userId,
  onWon,
}: {
  userId: string;
  onWon: (prize: Prize, tier: PrizeTier) => void;
}) => {
  const colors = useAppColors();
  const [award, setAward] = useState<AwardRow | null>(null);
  const [winner, setWinner] = useState<UserRow | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    motmApi.getAll().then(async ({ data }) => {
      const latest = data?.find((a) => a.period === periodOf(-1)) ?? null;
      setAward(latest);
      if (latest) {
        const { data: u } = await usersApi.getById(latest.user_id);
        setWinner(u ?? null);
      }
    });
  }, [userId]);

  if (!award || !winner) return null;

  const mine = award.user_id === userId;
  const tier = prizeTier(award.score, award.average);
  const prize =
    award.prize && award.prize_amount
      ? ({ prize: award.prize, amount: award.prize_amount } as Prize)
      : null;

  async function redeem() {
    setRedeeming(true);
    try {
      const { data, error } = await motmApi.redeem(award!.id);
      if (error) throw error;
      const won = data as Prize;
      setAward((a) => a && { ...a, prize: won.prize, prize_amount: won.amount });
      onWon(won, tier);
    } catch (err: any) {
      haptics.error();
      alert(err.message);
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <Card
      colors={{ containerColor: colors.tertiaryContainer }}
      modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(24))]}
    >
      <Column verticalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth(), paddingAll(20)]}>
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
          <Icon source={WorkspacePremium} tint={colors.onTertiaryContainer} size={20} />
          <Text
            style={{ typography: "labelLarge", fontWeight: "bold", letterSpacing: 0.5 }}
            color={colors.onTertiaryContainer}
          >
            {`MEMBER OF THE MONTH · ${periodLabel(award.period).toUpperCase()}`}
          </Text>
        </Row>
        <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }}>
          <Avatar
            fullname={winner.fullname}
            avatarUrl={winner.avatar_url}
            diameter={48}
            colors={avatarColorFor(winner.id, colors)}
          />
          <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[weight(1)]}>
            <Text
              style={{ typography: "titleLarge", fontWeight: "bold" }}
              color={colors.onTertiaryContainer}
            >
              {mine ? "Kamu!" : winner.fullname}
            </Text>
            <Text style={{ typography: "bodySmall" }} color={colors.onTertiaryContainer}>
              {prize
                ? `Hadiah: ${prizeLabel(prize)}`
                : mine
                  ? (TIER_HINT[tier] ?? "Performa terbaik bulan lalu. Ambil hadiahmu!")
                  : "Performa terbaik bulan lalu. Selamat!"}
            </Text>
          </Column>
        </Row>
        {mine && !prize && (
          <Button
            enabled={!redeeming}
            onClick={redeem}
            colors={{ containerColor: colors.tertiary, contentColor: colors.onTertiary }}
            modifiers={[fillMaxWidth(), height(48)]}
          >
            <ButtonContent
              loading={redeeming}
              enabled={!redeeming}
              label="Ambil hadiah"
              color={colors.onTertiary}
            />
          </Button>
        )}
      </Column>
    </Card>
  );
};
