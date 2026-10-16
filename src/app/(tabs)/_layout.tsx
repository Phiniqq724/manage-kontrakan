import { useAppColors } from "@/components/AppHost";
import { pagerRoute } from "@/utils/pager";
import {
  QUICK_ACTIONS,
  useNavItems,
  type QuickActionKey,
} from "@/utils/settings";
import { TopTabs } from "expo-router/js-top-tabs";

const ALL_PAGES = Object.keys(QUICK_ACTIONS) as QuickActionKey[];

// The swiper: Beranda, then exactly this account's navbar items in navbar
// order, so swiping and the navbar always match. Pages not in the navbar are
// guarded out of the swiper; they still open as normal pages.
// The navbar itself is rendered once in the root layout.
export default function TabsLayout() {
  const colors = useAppColors();
  const { keys } = useNavItems();
  const rest = ALL_PAGES.filter((k) => !keys.includes(k));

  return (
    <TopTabs
      tabBarPosition="bottom"
      tabBar={() => null}
      screenOptions={{ sceneStyle: { backgroundColor: colors.background } }}
    >
      <TopTabs.Screen name="dashboard" options={{ title: "Beranda" }} />
      {keys.map((k) => (
        <TopTabs.Screen
          key={k}
          name={pagerRoute(k)}
          options={{ title: QUICK_ACTIONS[k].label }}
        />
      ))}
      <TopTabs.Protected guard={false}>
        {rest.map((k) => (
          <TopTabs.Screen key={k} name={pagerRoute(k)} />
        ))}
      </TopTabs.Protected>
    </TopTabs>
  );
}
