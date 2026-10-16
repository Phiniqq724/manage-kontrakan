import type { QuickActionKey } from "@/utils/settings";
import { createContext, useContext, type ComponentType } from "react";

/**
 * The swiper (pager) holds Beranda plus the account's navbar items. Each page
 * that can be in the navbar has a swiper route named `t-<key>` that renders
 * the normal page; the normal page keeps its own URL for everything else.
 */
const InPagerContext = createContext(false);

/** True when this page is rendered inside the swiper (no back navigation there). */
export const useInPager = () => useContext(InPagerContext);

/** Wraps a page component for use as a swiper route. */
export const asPagerPage = (Page: ComponentType) => {
  const PagerPage = () => (
    <InPagerContext.Provider value>
      <Page />
    </InPagerContext.Provider>
  );
  return PagerPage;
};

/** Swiper route name of a navbar item, e.g. "members" -> "t-members". */
export const pagerRoute = (key: QuickActionKey) => `t-${key}` as const;

/** URL of a navbar item's swiper page, e.g. "/t-members". */
export const pagerPath = (key: QuickActionKey) => `/${pagerRoute(key)}`;

/** The page key behind a URL segment: "t-members" and "members" -> "members". */
export const pageKeyFromSegment = (segment: string) => segment.replace(/^t-/, "");
