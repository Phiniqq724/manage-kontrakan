import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ImageSourcePropType } from "react-native";
import { scrollReporter } from "../../modules/scroll-reporter";

export type TabAction = { icon: ImageSourcePropType; onPress: () => void };

// Three contexts so a hide/show or FAB change only re-renders the tab bar.
// Pages read just the setters, which never change, so they never re-render
// because of the bar (re-rendering a whole page made the hide animation lag).
type TabBarSetters = {
  register: (routeName: string, action: TabAction | null) => void;
  setHidden: (hidden: boolean) => void;
};

const SettersContext = createContext<TabBarSetters>({
  register: () => {},
  setHidden: () => {},
});
const ActionsContext = createContext<Record<string, TabAction>>({});
/** True while the user scrolls down; the tab bar slides away. */
const HiddenContext = createContext(false);

/** Holds each page's primary action (shown as the tab bar's FAB) and the bar's hidden state. */
export const TabActionProvider = ({ children }: { children: ReactNode }) => {
  const [actions, setActions] = useState<Record<string, TabAction>>({});
  const [hidden, setHidden] = useState(false);

  const register = useCallback(
    (routeName: string, action: TabAction | null) => {
      setActions((prev) => {
        const next = { ...prev };
        if (action) next[routeName] = action;
        else delete next[routeName];
        return next;
      });
    },
    [],
  );

  const setters = useMemo(() => ({ register, setHidden }), [register]);

  return (
    <SettersContext.Provider value={setters}>
      <ActionsContext.Provider value={actions}>
        <HiddenContext.Provider value={hidden}>
          {children}
        </HiddenContext.Provider>
      </ActionsContext.Provider>
    </SettersContext.Provider>
  );
};

/** All registered actions, keyed by route name. */
export const useTabActions = () => useContext(ActionsContext);

/** Whether the tab bar is hidden, and a setter (e.g. to show it on page change). */
export const useTabBarHidden = () =>
  [useContext(HiddenContext), useContext(SettersContext).setHidden] as const;

/**
 * Scroll modifier for a page's main column: use it instead of
 * `verticalScroll()`. Scrolling down hides the tab bar, scrolling up shows it.
 * Pass `enabled = false` to stop the page scrolling (e.g. while dragging).
 */
export const useHideOnScroll = (enabled = true) => {
  const { setHidden } = useContext(SettersContext);
  return useMemo(
    () =>
      scrollReporter((direction) => setHidden(direction === "down"), enabled),
    [setHidden, enabled],
  );
};

/**
 * Registers this tab page's primary action (shown as the tab bar's FAB while
 * the page is active). Keyed by route name, so swiping between pages never
 * races one page's cleanup against the next page's registration.
 * Pass `enabled = false` to register no action (e.g. admin-only buttons).
 */
export const useTabAction = (
  routeName: string,
  icon: ImageSourcePropType,
  onPress: () => void,
  enabled = true,
) => {
  const { register } = useContext(SettersContext);
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  useEffect(() => {
    if (!enabled) return;
    register(routeName, { icon, onPress: () => onPressRef.current() });
    return () => register(routeName, null);
  }, [routeName, icon, register, enabled]);
};
