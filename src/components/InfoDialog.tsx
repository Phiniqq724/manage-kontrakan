import { useAppColors } from "@/components/AppHost";
import { AlertDialog, Icon, Text, TextButton } from "@expo/ui/jetpack-compose";
import type { ImageSourcePropType } from "react-native";

/** Material dialog with a title, optional text and icon, and one "OK" button. Render inside an AppHost. */
export const InfoDialog = ({
  title,
  text,
  icon,
  onClose,
}: {
  title: string;
  text?: string;
  icon?: ImageSourcePropType;
  onClose: () => void;
}) => {
  const colors = useAppColors();
  return (
    <AlertDialog onDismissRequest={onClose}>
      {icon ? (
        <AlertDialog.Icon>
          <Icon source={icon} tint={colors.secondary} size={24} />
        </AlertDialog.Icon>
      ) : null}
      <AlertDialog.Title>
        <Text>{title}</Text>
      </AlertDialog.Title>
      {text ? (
        <AlertDialog.Text>
          <Text>{text}</Text>
        </AlertDialog.Text>
      ) : null}
      <AlertDialog.ConfirmButton>
        <TextButton onClick={onClose}>
          <Text color={colors.primary}>OK</Text>
        </TextButton>
      </AlertDialog.ConfirmButton>
    </AlertDialog>
  );
};
