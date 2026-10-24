import ShoppingCart from "@expo/material-symbols/shopping_cart.xml";
import FactCheck from "@expo/material-symbols/fact_check.xml";
import { useAppColors } from "@/components/AppHost";
import { QUICK_ACTIONS, type QuickActionKey } from "@/utils/settings";
import AccountBalanceWallet from "@expo/material-symbols/account_balance_wallet.xml";
import Bed from "@expo/material-symbols/bed.xml";
import CalendarMonth from "@expo/material-symbols/calendar_month.xml";
import Close from "@expo/material-symbols/close.xml";
import Description from "@expo/material-symbols/description.xml";
import Event from "@expo/material-symbols/event.xml";
import Flag from "@expo/material-symbols/flag.xml";
import Forum from "@expo/material-symbols/forum.xml";
import Gavel from "@expo/material-symbols/gavel.xml";
import Groups from "@expo/material-symbols/groups.xml";
import HowToReg from "@expo/material-symbols/how_to_reg.xml";
import Person from "@expo/material-symbols/person.xml";
import Receipt from "@expo/material-symbols/receipt.xml";
import { Box, Column, Icon, Row, Text } from "@expo/ui/jetpack-compose";
import {
  align,
  alpha,
  animateContentSize,
  background,
  clickable,
  clip,
  fillMaxWidth,
  Shapes,
  size,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import type { ReactNode } from "react";
import type { ImageSourcePropType } from "react-native";

export const QUICK_ACTION_ICONS: Record<QuickActionKey, ImageSourcePropType> = {
  members: Groups,
  events: Event,
  requests: Forum,
  receipts: Receipt,
  piket: CalendarMonth,
  rules: Gavel,
  guests: HowToReg,
  shopping: ShoppingCart,
  profile: Person,
  adminPayments: AccountBalanceWallet,
  adminRules: Description,
  adminReports: Flag,
  adminKamar: Bed,
  adminPiket: FactCheck,
};

/**
 * One quick action: icon tile plus label, as on Beranda. In the editor it can
 * be `selected` (picked up for swapping), `dimmed`, and show a remove button.
 * `icon`/`label` override the action's own, for fixed tiles such as Beranda.
 */
export const QuickActionTile = ({
  actionKey,
  icon = QUICK_ACTION_ICONS[actionKey!],
  label = QUICK_ACTIONS[actionKey!]?.label,
  onClick,
  selected = false,
  dimmed = false,
  onRemove,
  reserveRemove = false,
}: {
  actionKey?: QuickActionKey;
  icon?: ImageSourcePropType;
  label?: string;
  onClick: () => void;
  selected?: boolean;
  dimmed?: boolean;
  onRemove?: () => void;
  /** Keep the remove button's room even without one, so every tile in a grid is the same height. */
  reserveRemove?: boolean;
}) => {
  const colors = useAppColors();
  return (
    <Column
      horizontalAlignment="center"
      verticalArrangement={{ spacedBy: 6 }}
      modifiers={dimmed ? [alpha(0.4)] : []}
    >
      {/* Extra room around the tile only when the remove button sits on its corner. */}
      <Box modifiers={[onRemove || reserveRemove ? size(64, 64) : size(56, 56)]}>
        <Box
          contentAlignment="center"
          modifiers={[
            size(56, 56),
            align("center"),
            clip(Shapes.RoundedCorner(16)),
            background(selected ? colors.primary : colors.primaryContainer),
            clickable(onClick),
          ]}
        >
          <Icon
            source={icon}
            tint={selected ? colors.onPrimary : colors.onPrimaryContainer}
            size={24}
          />
        </Box>
        {onRemove ? (
          <Box
            contentAlignment="center"
            modifiers={[
              size(22, 22),
              // Stays inside the 64dp box: the rows animate their size, which
              // clips anything drawn outside it.
              align("topEnd"),
              clip(Shapes.RoundedCorner(11)),
              background(colors.error),
              clickable(onRemove),
            ]}
          >
            <Icon source={Close} tint={colors.onError} size={14} />
          </Box>
        ) : null}
      </Box>
      <Text
        style={{ typography: "labelMedium" }}
        color={colors.onSurfaceVariant}
        maxLines={1}
        overflow="ellipsis"
      >
        {label}
      </Text>
    </Column>
  );
};

/** Lays quick actions out in rows of 4, the same way everywhere. */
export const QuickActionRows = <K extends string = QuickActionKey>({
  keys,
  tile,
}: {
  keys: K[];
  tile: (key: K) => ReactNode;
}) => (
  <Column
    verticalArrangement={{ spacedBy: 12 }}
    modifiers={[fillMaxWidth(), animateContentSize()]}
  >
    {Array.from({ length: Math.ceil(keys.length / 4) }, (_, i) =>
      keys.slice(i * 4, i * 4 + 4),
    ).map((row) => (
      // 4 equal cells per row, so columns line up even in a short last row.
      <Row key={row.join()} modifiers={[fillMaxWidth()]}>
        {[0, 1, 2, 3].map((i) => (
          <Box
            key={row[i] ?? `empty-${i}`}
            contentAlignment="topCenter"
            modifiers={[weight(1)]}
          >
            {row[i] ? tile(row[i]) : null}
          </Box>
        ))}
      </Row>
    ))}
  </Column>
);
