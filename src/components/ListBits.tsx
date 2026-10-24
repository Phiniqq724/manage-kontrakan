import { haptics } from "@/utils/haptics";
import { useAppColors } from "@/components/AppHost";
import {
  Column,
  FilterChip,
  Icon,
  OutlinedButton,
  Row,
  Text,
} from "@expo/ui/jetpack-compose";
import {
  fillMaxWidth,
  height,
  horizontalScroll,
  padding,
} from "@expo/ui/jetpack-compose/modifiers";
import type { ImageSourcePropType } from "react-native";

/** Uppercase section label. */
export const SectionLabel = ({ children }: { children: string }) => {
  const colors = useAppColors();
  return (
    <Text
      style={{ typography: "labelLarge", fontWeight: "bold", letterSpacing: 0.5 }}
      color={colors.onSurfaceVariant}
    >
      {children}
    </Text>
  );
};

/** Icon + text pair, so status never relies on colour alone. */
export const IconText = ({
  icon,
  text,
  color,
  bold,
}: {
  icon: ImageSourcePropType;
  text: string;
  color?: string;
  bold?: boolean;
}) => {
  const colors = useAppColors();
  const c = color ?? colors.onSurfaceVariant;
  return (
    <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 4 }}>
      <Icon source={icon} tint={c} size={16} />
      <Text
        style={{ typography: "labelMedium", fontWeight: bold ? "bold" : "normal" }}
        color={c}
      >
        {text}
      </Text>
    </Row>
  );
};

/** Horizontally scrollable single-choice chips. */
export const ChipRow = <T extends string>({
  options,
  value,
  onChange,
}: {
  options: [T, string][];
  value: T;
  onChange: (v: T) => void;
}) => (
  <Row horizontalArrangement={{ spacedBy: 8 }} modifiers={[horizontalScroll()]}>
    {options.map(([v, label]) => (
      <FilterChip key={v} selected={v === value} onClick={() => {
          if (v !== value) haptics.tick();
          onChange(v);
        }}>
        <FilterChip.Label>
          <Text>{label}</Text>
        </FilterChip.Label>
      </FilterChip>
    ))}
  </Row>
);

/** Icon, one line of text and an optional action, for empty lists. */
export const EmptyState = ({
  icon,
  text,
  action,
  onAction,
}: {
  icon: ImageSourcePropType;
  text: string;
  action?: string;
  onAction?: () => void;
}) => {
  const colors = useAppColors();
  return (
    <Column
      horizontalAlignment="center"
      verticalArrangement={{ spacedBy: 8 }}
      modifiers={[fillMaxWidth(), padding(0, 24, 0, 24)]}
    >
      <Icon source={icon} tint={colors.onSurfaceVariant} size={32} />
      <Text style={{ typography: "bodyMedium" }} color={colors.onSurfaceVariant}>
        {text}
      </Text>
      {action && onAction && (
        <OutlinedButton onClick={onAction} modifiers={[height(48)]}>
          <Text style={{ typography: "labelLarge" }} color={colors.primary}>
            {action}
          </Text>
        </OutlinedButton>
      )}
    </Column>
  );
};
