import { AppHost, useAppColors } from "@/components/AppHost";
import { applyUpdate, useAutoUpdateCheck } from "@/utils/ota";
import Close from "@expo/material-symbols/close.xml";
import SystemUpdate from "@expo/material-symbols/system_update_alt.xml";
import {
  Card,
  Icon,
  IconButton,
  Row,
  Text,
  TextButton,
} from "@expo/ui/jetpack-compose";
import {
  clip,
  fillMaxWidth,
  padding,
  Shapes,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useUpdates } from "expo-updates";
import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Runs the automatic OTA check, and once an update has downloaded shows a
 * bar at the top to restart into it. Can be dismissed until the next launch.
 */
export const UpdateBanner = () => {
  useAutoUpdateCheck();
  const { isUpdatePending } = useUpdates();
  const [dismissed, setDismissed] = useState(false);
  const colors = useAppColors();
  const insets = useSafeAreaInsets();

  if (!isUpdatePending || dismissed) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", top: insets.top + 8, left: 16, right: 16 }}
    >
      <AppHost matchContents={{ vertical: true }} style={{ width: "100%" }}>
        <Card
          colors={{ containerColor: colors.inverseSurface }}
          modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(16))]}
        >
          <Row
            verticalAlignment="center"
            horizontalArrangement={{ spacedBy: 8 }}
            modifiers={[fillMaxWidth(), padding(16, 4, 4, 4)]}
          >
            <Icon source={SystemUpdate} tint={colors.inverseOnSurface} size={20} />
            <Text
              style={{ typography: "bodyMedium", fontWeight: "bold" }}
              color={colors.inverseOnSurface}
              modifiers={[weight(1)]}
            >
              Pembaruan siap
            </Text>
            <TextButton onClick={() => applyUpdate()}>
              <Text style={{ typography: "labelLarge" }} color={colors.inversePrimary}>
                Mulai ulang
              </Text>
            </TextButton>
            <IconButton onClick={() => setDismissed(true)}>
              <Icon source={Close} tint={colors.inverseOnSurface} size={18} />
            </IconButton>
          </Row>
        </Card>
      </AppHost>
    </View>
  );
};
