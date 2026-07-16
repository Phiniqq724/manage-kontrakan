import { Host } from "@expo/ui";
import {
  Box,
  Column,
  LinearWavyProgressIndicator,
  RNHostView,
  Text,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  background,
  clip,
  fillMaxSize,
  Shapes,
  size,
} from "@expo/ui/jetpack-compose/modifiers";
import { useEffect, useRef, useState } from "react";
import { SemanggiIcon } from "./SemanggiIcon";

const START_PROGRESS = 0.06;
const IDLE_CEILING = 0.92;
const CREEP_PER_TICK = 0.006;
const EASE_FACTOR = 0.15;
const TICK_MS = 60;

/**
 * Eases a displayed progress value toward `milestone` (a known boot
 * checkpoint, e.g. 0.5 once fonts are ready). While waiting on the next
 * checkpoint it keeps creeping toward `IDLE_CEILING` so the bar never sits
 * still, and passing `1` lets it ease all the way to completion.
 */
function useBootProgress(milestone: number | undefined) {
  const [displayed, setDisplayed] = useState(START_PROGRESS);
  const milestoneRef = useRef(milestone);
  milestoneRef.current = milestone;

  useEffect(() => {
    const id = setInterval(() => {
      setDisplayed((current) => {
        const known = milestoneRef.current ?? 0;
        const ceiling =
          known >= 1
            ? 1
            : Math.max(known, Math.min(current + CREEP_PER_TICK, IDLE_CEILING));
        if (current >= ceiling) return current;
        const next = current + (ceiling - current) * EASE_FACTOR;
        return ceiling - next < 0.01 ? ceiling : next;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  return displayed;
}

type LoadingScreenProps = {
  /**
   * Known boot checkpoint reached so far, between `0` and `1` (e.g. `0.5`
   * once fonts are ready and only the session check is left). Pass `1` once
   * everything is done to let the bar ease to completion before unmounting.
   * Omit while no checkpoint has been reached yet.
   */
  progress?: number;
};

export function LoadingScreen({ progress }: LoadingScreenProps) {
  const colors = useMaterialColors();
  const displayed = useBootProgress(progress);

  return (
    <Host style={{ flex: 1 }}>
      <Column
        horizontalAlignment="center"
        verticalArrangement="center"
        modifiers={[fillMaxSize(), background(colors.background)]}
      >
        <Column
          horizontalAlignment="center"
          verticalArrangement={{ spacedBy: 20 }}
        >
          <Box
            contentAlignment="center"
            modifiers={[
              size(72, 72),
              clip(Shapes.RoundedCorner(20)),
              background(colors.primaryContainer),
            ]}
          >
            <RNHostView>
              <SemanggiIcon size={72} color={colors.onPrimaryContainer} />
            </RNHostView>
          </Box>
          <Text
            style={{ typography: "headlineMedium", fontWeight: "bold" }}
            color={colors.onBackground}
          >
            Semanggi
          </Text>
          <LinearWavyProgressIndicator
            progress={displayed}
            color={colors.primary}
            modifiers={[size(240, 12)]}
          />
        </Column>
      </Column>
    </Host>
  );
}
