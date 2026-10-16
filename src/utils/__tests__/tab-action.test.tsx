/// <reference types="jest" />

// Pretend this build includes the native ScrollReporter module.
jest.mock("expo", () => ({ requireOptionalNativeModule: () => ({}) }));

import { act, create, type ReactTestRenderer } from "react-test-renderer";

import {
  TabActionProvider,
  useHideOnScroll,
  useTabAction,
  useTabActions,
  useTabBarHidden,
  type TabAction,
} from "@/utils/tab-action";

const ICON = 1;
let latest: Record<string, TabAction> = {};

const Probe = () => {
  latest = useTabActions();
  return null;
};

const Page = ({
  name,
  onPress,
  enabled,
}: {
  name: string;
  onPress: () => void;
  enabled?: boolean;
}) => {
  useTabAction(name, ICON, onPress, enabled);
  return null;
};

const render = (ui: React.ReactElement) => {
  let root!: ReactTestRenderer;
  act(() => {
    root = create(ui);
  });
  return root;
};

describe("useTabAction", () => {
  beforeEach(() => {
    latest = {};
  });

  it("registers nothing when disabled", () => {
    render(
      <TabActionProvider>
        <Page name="receipts" onPress={() => {}} enabled={false} />
        <Probe />
      </TabActionProvider>,
    );
    expect(latest).toEqual({});
  });

  it("registers each page's action under its route name", () => {
    render(
      <TabActionProvider>
        <Page name="guests" onPress={() => {}} />
        <Page name="rules" onPress={() => {}} />
        <Probe />
      </TabActionProvider>,
    );
    expect(Object.keys(latest).sort()).toEqual(["guests", "rules"]);
    expect(latest.guests.icon).toBe(ICON);
  });

  it("removes the action when the page unmounts", () => {
    const root = render(
      <TabActionProvider>
        <Page name="guests" onPress={() => {}} />
        <Probe />
      </TabActionProvider>,
    );
    act(() => {
      root.update(
        <TabActionProvider>
          <Probe />
        </TabActionProvider>,
      );
    });
    expect(latest).toEqual({});
  });

  it("always calls the page's latest handler", () => {
    const first = jest.fn();
    const second = jest.fn();
    const root = render(
      <TabActionProvider>
        <Page name="rules" onPress={first} />
        <Probe />
      </TabActionProvider>,
    );
    act(() => {
      root.update(
        <TabActionProvider>
          <Page name="rules" onPress={second} />
          <Probe />
        </TabActionProvider>,
      );
    });
    latest.rules.onPress();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe("useHideOnScroll", () => {
  it("hides the tab bar on a down scroll and shows it on an up scroll", () => {
    let modifier!: ReturnType<typeof useHideOnScroll>;
    let hidden = false;

    const ScrollPage = () => {
      modifier = useHideOnScroll();
      [hidden] = useTabBarHidden();
      return null;
    };

    render(
      <TabActionProvider>
        <ScrollPage />
      </TabActionProvider>,
    );
    expect(modifier.$type).toBe("scrollReporter");
    expect(hidden).toBe(false);

    act(() => modifier.eventListener?.({ direction: "down" }));
    expect(hidden).toBe(true);

    act(() => modifier.eventListener?.({ direction: "up" }));
    expect(hidden).toBe(false);
  });
});

describe("re-render isolation", () => {
  it("does not re-render pages when the tab bar hides or shows", () => {
    let pageRenders = 0;
    let modifier!: ReturnType<typeof useHideOnScroll>;

    const ScrollPage = () => {
      pageRenders += 1;
      modifier = useHideOnScroll();
      useTabAction("guests", ICON, () => {});
      return null;
    };

    render(
      <TabActionProvider>
        <ScrollPage />
        <Probe />
      </TabActionProvider>,
    );
    const before = pageRenders;

    act(() => modifier.eventListener?.({ direction: "down" }));
    act(() => modifier.eventListener?.({ direction: "up" }));

    expect(pageRenders).toBe(before);
  });
});
