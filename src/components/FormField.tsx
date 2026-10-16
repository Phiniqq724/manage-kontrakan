import { Icon, OutlinedTextField, Text } from "@expo/ui/jetpack-compose";
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers";
import type { ComponentProps } from "react";
import type { ImageSourcePropType } from "react-native";

/** Full-width outlined text field with a plain text label and an optional leading icon. */
export const FormField = ({
  label,
  icon,
  ...props
}: { label: string; icon?: ImageSourcePropType } & Omit<
  ComponentProps<typeof OutlinedTextField>,
  "children"
>) => (
  <OutlinedTextField modifiers={[fillMaxWidth()]} {...props}>
    <OutlinedTextField.Label>
      <Text>{label}</Text>
    </OutlinedTextField.Label>
    {icon ? (
      <OutlinedTextField.LeadingIcon>
        <Icon source={icon} size={20} />
      </OutlinedTextField.LeadingIcon>
    ) : null}
  </OutlinedTextField>
);
