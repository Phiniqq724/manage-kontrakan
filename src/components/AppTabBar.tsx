import { guestsApi, piketsApi, ruleRequestsApi, ruleRequestVotesApi } from "@/services/api";
import { useAuth } from "@/utils/auth-context";
import { getTodayStr } from "@/utils/piket-utils";
import CalendarMonth from "@expo/material-symbols/calendar_month.xml";
import Gavel from "@expo/material-symbols/gavel.xml";
import Groups from "@expo/material-symbols/groups.xml";
import Home from "@expo/material-symbols/home.xml";
import HowToReg from "@expo/material-symbols/how_to_reg.xml";
import { Host } from "@expo/ui";
import {
  Badge,
  BadgedBox,
  Icon,
  NavigationBar,
  NavigationBarItem,
  Text,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import { padding } from "@expo/ui/jetpack-compose/modifiers";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { useCallback, useEffect, useState } from "react";
import type { ImageSourcePropType } from "react-native";

const TAB_ICONS: Record<string, ImageSourcePropType> = {
  dashboard: Home,
  piket: CalendarMonth,
  guests: HowToReg,
  rules: Gavel,
  members: Groups,
};

function TabIcon({
  source,
  badge,
}: {
  source: ImageSourcePropType;
  badge: number | boolean | undefined;
}) {
  const colors = useMaterialColors();
  const icon = <Icon source={source} size={24} />;

  if (!badge) return icon;

  return (
    <BadgedBox>
      {icon}
      <BadgedBox.Badge>
        <Badge containerColor={colors.error}>
          {typeof badge === "number" && (
            <Text style={{ typography: "labelSmall" }} color={colors.onError}>
              {String(badge)}
            </Text>
          )}
        </Badge>
      </BadgedBox.Badge>
    </BadgedBox>
  );
}

export function AppTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const colors = useMaterialColors();
  const { user } = useAuth();

  const [guestCount, setGuestCount] = useState(0);
  const [voteCount, setVoteCount] = useState(0);
  const [piketToday, setPiketToday] = useState(false);

  const loadCounts = useCallback(async () => {
    if (!user) return;
    const [guestRes, ruleReqRes, myVotesRes, piketRes] = await Promise.all([
      guestsApi.getAll(),
      ruleRequestsApi.getAll(),
      ruleRequestVotesApi.getAllMine(user.id),
      piketsApi.getByUser(user.id),
    ]);

    setGuestCount((guestRes.data ?? []).filter((g) => !g.check_out).length);

    const votedIds = new Set(
      (myVotesRes.data ?? []).map((v) => v.rule_request_id),
    );
    const votable = (ruleReqRes.data ?? []).filter(
      (r) =>
        r.status === "pending" &&
        r.assign_by !== user.id &&
        !votedIds.has(r.id) &&
        user.role !== "admin",
    );
    setVoteCount(votable.length);

    const todayStr = getTodayStr();
    setPiketToday(
      (piketRes.data ?? []).some(
        (p) => p.day === todayStr && p.status !== "done",
      ),
    );
  }, [user?.id, user?.role]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const BADGES: Record<string, number | boolean | undefined> = {
    guests: guestCount || undefined,
    rules: voteCount || undefined,
    piket: piketToday,
  };

  return (
    <Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
      <NavigationBar
        containerColor={colors.surfaceContainer}
        modifiers={[padding(0, 0, 0, insets.bottom)]}
      >
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const { title } = descriptors[route.key].options;
          const icon = TAB_ICONS[route.name];
          const badge = BADGES[route.name];

          const onClick = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
            loadCounts();
          };

          return (
            <NavigationBarItem key={route.key} selected={isFocused} onClick={onClick}>
              <NavigationBarItem.Icon>
                <TabIcon source={icon} badge={badge} />
              </NavigationBarItem.Icon>
              <NavigationBarItem.Label>
                <Text style={{ typography: "labelMedium" }}>{title ?? route.name}</Text>
              </NavigationBarItem.Label>
            </NavigationBarItem>
          );
        })}
      </NavigationBar>
    </Host>
  );
}
