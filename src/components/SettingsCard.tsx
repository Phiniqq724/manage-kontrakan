import { useAppColors } from "@/components/AppHost";
import { Column, Row, Text } from "@expo/ui/jetpack-compose";
import {
  background,
  clip,
  fillMaxWidth,
  paddingAll,
  Shapes,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import type { ReactNode } from "react";

/** Settings group: rounded card with a bold title, optional subtitle and trailing slot. */
export const SettingsCard = ({
  title,
  subtitle,
  trailing,
  children,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  children: ReactNode;
}) => {
  const colors = useAppColors();
  return (
    <Column
      verticalArrangement={{ spacedBy: 16 }}
      modifiers={[
        fillMaxWidth(),
        clip(Shapes.RoundedCorner(20)),
        background(colors.surfaceContainerLow),
        paddingAll(16),
      ]}
    >
      <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
        <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[weight(1)]}>
          <Text
            style={{ typography: "titleMedium", fontWeight: "bold" }}
            color={colors.onSurface}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ typography: "bodySmall" }} color={colors.onSurfaceVariant}>
              {subtitle}
            </Text>
          ) : null}
        </Column>
        {trailing}
      </Row>
      {children}
    </Column>
  );
};

/** Small bold label for a sub-group inside a settings card. */
export const CardLabel = ({ children }: { children: string }) => {
  const colors = useAppColors();
  return (
    <Text
      style={{ typography: "labelLarge", fontWeight: "bold" }}
      color={colors.onSurfaceVariant}
    >
      {children}
    </Text>
  );
};
