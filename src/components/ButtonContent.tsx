import {
  CircularWavyProgressIndicator,
  Text,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import { size } from "@expo/ui/jetpack-compose/modifiers";

export function ButtonContent({
  loading,
  label,
  color,
  enabled = true,
  bold = true,
}: {
  loading: boolean;
  label: string;
  color: string;
  /** Whether the wrapping Button is currently interactive. When false (or while loading), the content dims to `colors.outline` so a disabled/busy button reads as clearly non-actionable instead of looking identical to an active one. */
  enabled?: boolean;
  bold?: boolean;
}) {
  const colors = useMaterialColors();
  const effectiveColor = enabled && !loading ? color : colors.outline;

  if (loading) {
    return (
      <CircularWavyProgressIndicator
        color={effectiveColor}
        modifiers={[size(20, 20)]}
      />
    );
  }
  return (
    <Text
      style={{ typography: "labelLarge", fontWeight: bold ? "bold" : undefined }}
      color={effectiveColor}
    >
      {label}
    </Text>
  );
}
