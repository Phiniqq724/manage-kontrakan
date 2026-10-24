import { AppHost, useAppColors } from "@/components/AppHost";
import {
  guestsApi,
  piketsApi,
  ruleRequestsApi,
  ruleRequestVotesApi,
  shoppingApi,
} from "@/services/api";
import { shoppingBadgeCount } from "@/utils/shopping";
import { useAuth } from "@/utils/auth-context";
import { getTodayStr } from "@/utils/piket-utils";
import Home from "@expo/material-symbols/home.xml";
import {
  AnimatedVisibility,
  Badge,
  BadgedBox,
  Box,
  Column,
  EnterTransition,
  ExitTransition,
  FloatingActionButton,
  HorizontalFloatingToolbar,
  Icon,
  NavigationBar,
  NavigationBarItem,
  Row,
  Text,
} from "@expo/ui/jetpack-compose";
import {
  animateContentSize,
  background,
  clickable,
  clip,
  fillMaxWidth,
  matchParentSize,
  padding,
  Shapes,
} from "@expo/ui/jetpack-compose/modifiers";
import { router, usePathname, type Href } from "expo-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  useWindowDimensions,
  View,
  type ImageSourcePropType,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { QUICK_ACTION_ICONS } from "@/components/QuickActions";
import { pageKeyFromSegment, pagerPath, pagerRoute } from "@/utils/pager";
import {
  QUICK_ACTIONS,
  useNavItems,
  useSettings,
  type NavLabels,
  type QuickActionKey,
} from "@/utils/settings";
import { useTabActions, useTabBarHidden } from "@/utils/tab-action";

export type NavItem = {
  key: string;
  title: string;
  icon: ImageSourcePropType;
  /** Where the item lives in the swiper. */
  href: string;
  /** URLs that count as this item being open (swiper page and normal page). */
  paths: string[];
};

const BERANDA: NavItem = {
  key: "dashboard",
  title: "Beranda",
  icon: Home,
  href: "/(tabs)/dashboard",
  paths: ["/dashboard"],
};

function TabIcon({
  source,
  badge,
  tint,
}: {
  source: ImageSourcePropType;
  badge: number | boolean | undefined;
  tint: string;
}) {
  const colors = useAppColors();
  const icon = <Icon source={source} size={24} tint={tint} />;

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

/**
 * Navbar shown over every signed-in page: Beranda plus this account's chosen
 * items (Pengaturan), as a floating pill or a classic full-width bar. The
 * active item is the one whose page is open; on other pages none is.
 */
export function AppTabBar() {
  const colors = useAppColors();
  const pathname = usePathname();
  // Pages register their FAB under their own name; "t-members" (swiper) and
  // "members" (normal page) are the same page.
  const current = pageKeyFromSegment(
    pathname.split("/").filter(Boolean).pop() ?? "",
  );
  const { keys: navKeys } = useNavItems();
  const items = navItemsFor(navKeys);
  const activeItem = items.find((item) => item.paths.includes(pathname));
  // In the swiper: Beranda or a navbar item's swiper page.
  const onTabPage = pathname === "/dashboard" || pathname.startsWith("/t-");
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [guestCount, setGuestCount] = useState(0);
  const [voteCount, setVoteCount] = useState(0);
  const [piketToday, setPiketToday] = useState(false);
  const [shoppingCount, setShoppingCount] = useState(0);

  const loadCounts = useCallback(async () => {
    if (!user) return;
    const [guestRes, ruleReqRes, myVotesRes, piketRes, shoppingRes] =
      await Promise.all([
        guestsApi.getAll(),
        ruleRequestsApi.getAll(),
        ruleRequestVotesApi.getAllMine(user.id),
        piketsApi.getByUser(user.id),
        shoppingApi.getAll(),
      ]);
    setShoppingCount(shoppingBadgeCount(shoppingRes.data ?? [], user.id));

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

  // Refresh badges whenever the visible page changes (tap, swipe or push).
  useEffect(() => {
    loadCounts();
  }, [loadCounts, pathname]);

  const BADGES: Record<string, number | boolean | undefined> = {
    guests: guestCount || undefined,
    rules: voteCount || undefined,
    piket: piketToday,
    shopping: shoppingCount || undefined,
  };

  const actions = useTabActions();
  const [hidden, setHidden] = useTabBarHidden();

  // A new page starts at its top, so always bring the bar back on page change.
  useEffect(() => {
    setHidden(false);
  }, [pathname, setHidden]);

  const action = actions[current];
  // Narrow phones (~360dp) get tighter item padding so the pill and FAB fit.
  const compact = useWindowDimensions().width < 380;

  const { settings } = useSettings();
  if (!user || pathname === "/" || pathname.startsWith("/auth")) return null;
  // Pengaturan shows its own preview of the bar instead.
  if (pathname === "/settings") return null;
  const classic = settings.navStyle === "classic";

  const fab = (
    <AnimatedVisibility
      visible={!!action}
      enterTransition={EnterTransition.scaleIn().plus(EnterTransition.fadeIn())}
      exitTransition={ExitTransition.scaleOut().plus(ExitTransition.fadeOut())}
    >
      <FloatingActionButton
        containerColor={colors.primaryContainer}
        onClick={() => action?.onPress()}
      >
        <FloatingActionButton.Icon>
          {action ? (
            <Icon
              source={action.icon}
              size={24}
              tint={colors.onPrimaryContainer}
            />
          ) : null}
        </FloatingActionButton.Icon>
      </FloatingActionButton>
    </AnimatedVisibility>
  );

  // Classic lives only on the swiper pages, and the floating bar can be set
  // to; elsewhere the page's FAB still shows on its own.
  if (!onTabPage && (classic || !settings.navOnAllPages)) {
    return (
      <View
        pointerEvents="box-none"
        style={{ position: "absolute", right: 16, bottom: insets.bottom + 16 }}
      >
        <AppHost matchContents>{fab}</AppHost>
      </View>
    );
  }

  const open = (item: NavItem) => {
    if (item === activeItem) return;
    // In the swiper, switch pages; from a normal page, pop back to the swiper.
    if (onTabPage) router.navigate(item.href as Href);
    else router.dismissTo(item.href as Href);
  };
  const visible = classic || !(hidden && settings.hideNavOnScroll);
  const slide = {
    enterTransition: EnterTransition.slideInVertically({
      initialOffsetY: 1,
    }).plus(EnterTransition.fadeIn()),
    exitTransition: ExitTransition.slideOutVertically({
      targetOffsetY: 1,
    }).plus(ExitTransition.fadeOut()),
  };
  const bar = (
    <NavBarView
      items={items}
      activeKey={activeItem?.key}
      classic={classic}
      labels={settings.navLabels}
      badges={BADGES}
      compact={compact}
      bottomInset={insets.bottom}
      fab={fab}
      onPress={open}
    />
  );

  if (classic) {
    // Classic: Material's full-width bar at the very bottom, FAB above it.
    return (
      <View
        pointerEvents="box-none"
        style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}
      >
        <AppHost matchContents={{ vertical: true }} style={{ width: "100%" }}>
          <AnimatedVisibility visible={visible} {...slide}>
            {bar}
          </AnimatedVisibility>
        </AppHost>
      </View>
    );
  }

  // Floats over the pages; the wrapper takes no layout space.
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: insets.bottom + 4,
        alignItems: "center",
      }}
    >
      {/* Full-width host that only resizes vertically: the pill and FAB
          animate inside it, so their edges and shadow never get clipped. */}
      <AppHost matchContents={{ vertical: true }} style={{ width: "100%" }}>
        <Box contentAlignment="center" modifiers={[fillMaxWidth()]}>
          <AnimatedVisibility visible={visible} {...slide}>
            {bar}
          </AnimatedVisibility>
        </Box>
      </AppHost>
    </View>
  );
}

/** Beranda plus the given pages as navbar items (shared by the bar and its Pengaturan preview). */
export const navItemsFor = (keys: QuickActionKey[]): NavItem[] => [
  BERANDA,
  ...keys.map((k) => ({
    key: k,
    title: QUICK_ACTIONS[k].label,
    icon: QUICK_ACTION_ICONS[k],
    href: `/(tabs)/${pagerRoute(k)}`,
    paths: [pagerPath(k), QUICK_ACTIONS[k].href],
  })),
];

/**
 * The navbar itself, without positioning: the classic Material bar (FAB
 * above it) or the floating pill (FAB beside it). Used by the real bar and,
 * without a FAB or taps, as the live preview in Pengaturan.
 */
export const NavBarView = ({
  items,
  activeKey,
  classic,
  labels,
  badges = {},
  compact = false,
  bottomInset = 0,
  fab,
  onPress,
}: {
  items: NavItem[];
  activeKey?: string;
  classic: boolean;
  labels: NavLabels;
  badges?: Record<string, number | boolean | undefined>;
  compact?: boolean;
  bottomInset?: number;
  fab?: ReactNode;
  onPress?: (item: NavItem) => void;
}) => {
  const colors = useAppColors();
  const itemPad = compact ? 10 : 14;
  const showLabel = (focused: boolean) =>
    classic || (labels === "active" && focused);

  if (classic) {
    return (
      <Column horizontalAlignment="end" modifiers={[fillMaxWidth()]}>
        {fab ? <Box modifiers={[padding(0, 0, 16, 16)]}>{fab}</Box> : null}
        <NavigationBar
          containerColor={colors.surfaceContainer}
          modifiers={[padding(0, 0, 0, bottomInset)]}
        >
          {items.map((item) => {
            const focused = item.key === activeKey;
            return (
              <NavigationBarItem
                key={item.key}
                selected={focused}
                alwaysShowLabel
                onClick={() => onPress?.(item)}
              >
                <NavigationBarItem.Icon>
                  <TabIcon
                    source={item.icon}
                    badge={badges[item.key]}
                    tint={
                      focused
                        ? colors.onSecondaryContainer
                        : colors.onSurfaceVariant
                    }
                  />
                </NavigationBarItem.Icon>
                <NavigationBarItem.Label>
                  <Text style={{ typography: "labelMedium" }} maxLines={1}>
                    {item.title}
                  </Text>
                </NavigationBarItem.Label>
              </NavigationBarItem>
            );
          })}
        </NavigationBar>
      </Column>
    );
  }

  return (
    <Row
      verticalAlignment="center"
      horizontalArrangement={{ spacedBy: 8 }}
      modifiers={[padding(0, 8, 0, 8), animateContentSize()]}
    >
      <HorizontalFloatingToolbar
        colors={{ toolbarContainerColor: colors.surfaceContainerHigh }}
      >
        {items.map((item) => {
          const isFocused = item.key === activeKey;
          const tint = isFocused
            ? colors.onSecondaryContainer
            : colors.onSurfaceVariant;

          return (
            // The pill and its ripple are clipped on a layer behind the
            // content, so the badge (which sits past the icon's corner)
            // isn't cut off by the rounded clip.
            // No animateContentSize here: the label already animates its own
            // width, and a second size animation clips the content while it
            // catches up (the right edge looked cut off on page change).
            <Box key={item.key}>
              <Box
                modifiers={[
                  matchParentSize(),
                  clip(Shapes.RoundedCorner(20)),
                  background(
                    isFocused ? colors.secondaryContainer : "transparent",
                  ),
                  ...(onPress ? [clickable(() => onPress(item))] : []),
                ]}
              />
              <Row
                verticalAlignment="center"
                horizontalArrangement={{ spacedBy: 6 }}
                modifiers={[padding(itemPad, 10, itemPad, 10)]}
              >
                <TabIcon
                  source={item.icon}
                  badge={badges[item.key]}
                  tint={tint}
                />
                <AnimatedVisibility
                  visible={showLabel(isFocused)}
                  enterTransition={EnterTransition.fadeIn().plus(
                    EnterTransition.expandHorizontally(),
                  )}
                  exitTransition={ExitTransition.fadeOut().plus(
                    ExitTransition.shrinkHorizontally(),
                  )}
                >
                  <Text
                    style={{ typography: "labelLarge", fontWeight: "bold" }}
                    color={tint}
                    maxLines={1}
                  >
                    {item.title}
                  </Text>
                </AnimatedVisibility>
              </Row>
            </Box>
          );
        })}
      </HorizontalFloatingToolbar>

      {fab}
    </Row>
  );
};
