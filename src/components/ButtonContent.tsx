import { CircularWavyProgressIndicator, Text } from "@expo/ui/jetpack-compose";
import { size } from "@expo/ui/jetpack-compose/modifiers";

export function ButtonContent({
  loading,
  label,
  color,
  bold = true,
}: {
  loading: boolean;
  label: string;
  color: string;
  bold?: boolean;
}) {
  if (loading) {
    return (
      <CircularWavyProgressIndicator color={color} modifiers={[size(20, 20)]} />
    );
  }
  return (
    <Text
      style={{ typography: "labelLarge", fontWeight: bold ? "bold" : undefined }}
      color={color}
    >
      {label}
    </Text>
  );
}
