import { useAppColors } from "@/components/AppHost";
import { Avatar, avatarColorFor } from "@/components/Avatar";
import { durationLabel, parseTs, whatsappLink } from "@/utils/guest-utils";
import type { Database } from "@/utils/supabase-types";
import Call from "@expo/material-symbols/call.xml";
import Chat from "@expo/material-symbols/chat.xml";
import ArrowDown from "@expo/material-symbols/keyboard_arrow_down.xml";
import ArrowUp from "@expo/material-symbols/keyboard_arrow_up.xml";
import Logout from "@expo/material-symbols/logout.xml";
import {
  Column,
  FilledTonalButton,
  Icon,
  OutlinedButton,
  OutlinedCard,
  Row,
  Text,
} from "@expo/ui/jetpack-compose";
import {
  animateContentSize,
  clickable,
  clip,
  defaultMinSize,
  fillMaxWidth,
  padding,
  paddingAll,
  Shapes,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { Linking } from "react-native";

type GuestRow = Database["public"]["Tables"]["guests"]["Row"];

const timeLabel = (d: Date) =>
  d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
const open = (url: string) => Linking.openURL(url).catch(() => {});
const tall = defaultMinSize({ minHeight: 48 });

/** Expandable guest card: name, times and live duration; tap to reveal activity, inviter and call/WhatsApp actions. */
export const GuestCard = ({
  guest: g,
  inviter,
  now,
  expanded,
  onToggle,
  onCheckOut,
}: {
  guest: GuestRow;
  inviter: string;
  now: Date;
  expanded: boolean;
  onToggle: () => void;
  /** Provided only when the current user may check this guest out. */
  onCheckOut?: () => void;
}) => {
  const colors = useAppColors();
  const checkIn = parseTs(g.check_in);
  const checkOut = g.check_out ? parseTs(g.check_out) : null;
  const subtitle = checkOut
    ? `${timeLabel(checkIn)} - ${timeLabel(checkOut)} · ${durationLabel(checkIn, checkOut)}`
    : `Masuk ${timeLabel(checkIn)} · ${durationLabel(checkIn, now)} di dalam`;
  const wa = whatsappLink(g.phone);

  return (
    // The whole card toggles; its buttons still handle their own taps.
    <OutlinedCard
      modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(12)), clickable(onToggle)]}
    >
      <Column
        verticalArrangement={{ spacedBy: 12 }}
        modifiers={[fillMaxWidth(), animateContentSize(), paddingAll(16)]}
      >
        <Row
          verticalAlignment="center"
          horizontalArrangement={{ spacedBy: 12 }}
          modifiers={[fillMaxWidth(), tall]}
        >
          <Avatar fullname={g.name} diameter={40} colors={avatarColorFor(g.id, colors)} />
          <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[weight(1)]}>
            <Text style={{ typography: "bodyLarge", fontWeight: "bold" }} color={colors.onSurface}>
              {g.name}
            </Text>
            <Text style={{ typography: "bodySmall" }} color={colors.onSurfaceVariant}>
              {subtitle}
            </Text>
          </Column>
          <Icon source={expanded ? ArrowUp : ArrowDown} tint={colors.onSurfaceVariant} size={24} />
        </Row>

        {expanded && (
          <Column verticalArrangement={{ spacedBy: 4 }} modifiers={[padding(52, 0, 0, 0)]}>
            <Text style={{ typography: "bodyMedium" }} color={colors.onSurface}>
              {g.activity || "Tanpa keterangan kegiatan"}
            </Text>
            <Text style={{ typography: "bodySmall" }} color={colors.onSurfaceVariant}>
              {`Diundang ${inviter}${g.phone ? ` · ${g.phone}` : ""}`}
            </Text>
          </Column>
        )}

        {expanded && g.phone ? (
          <Row horizontalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
            <OutlinedButton onClick={() => open(`tel:${g.phone}`)} modifiers={[weight(1), tall]}>
              <Icon source={Call} tint={colors.primary} size={18} />
              <Text style={{ typography: "labelLarge" }} color={colors.primary}>{"  Telepon"}</Text>
            </OutlinedButton>
            {wa && (
              <OutlinedButton onClick={() => open(wa)} modifiers={[weight(1), tall]}>
                <Icon source={Chat} tint={colors.primary} size={18} />
                <Text style={{ typography: "labelLarge" }} color={colors.primary}>{"  WhatsApp"}</Text>
              </OutlinedButton>
            )}
          </Row>
        ) : null}

        {!checkOut && onCheckOut && (
          <FilledTonalButton onClick={onCheckOut} modifiers={[fillMaxWidth(), tall]}>
            <Icon source={Logout} tint={colors.onSecondaryContainer} size={18} />
            <Text style={{ typography: "labelLarge", fontWeight: "bold" }} color={colors.onSecondaryContainer}>
              {"  Checkout"}
            </Text>
          </FilledTonalButton>
        )}
      </Column>
    </OutlinedCard>
  );
};
