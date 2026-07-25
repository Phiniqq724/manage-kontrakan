import type { Database } from "@/utils/supabase-types";
import {
  Box,
  RNHostView,
  Text,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import { background, clip, Shapes, size } from "@expo/ui/jetpack-compose/modifiers";
import { Image } from "react-native";

type UserRow = Database["public"]["Tables"]["users"]["Row"];

export function VoterAvatar({
  user,
  diameter,
}: {
  user: UserRow;
  diameter: number;
}) {
  const colors = useMaterialColors();
  const radius = diameter / 2;
  const ringSize = diameter + 4;

  const inner = user.avatar_url ? (
    <Box modifiers={[size(diameter, diameter), clip(Shapes.RoundedCorner(radius))]}>
      <RNHostView>
        <Image
          source={{ uri: user.avatar_url }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
        />
      </RNHostView>
    </Box>
  ) : (
    <Box
      contentAlignment="center"
      modifiers={[
        size(diameter, diameter),
        clip(Shapes.RoundedCorner(radius)),
        background(colors.primaryContainer),
      ]}
    >
      <Text style={{ typography: "labelSmall", fontWeight: "bold" }} color={colors.onPrimaryContainer}>
        {user.fullname[0]?.toUpperCase() ?? "?"}
      </Text>
    </Box>
  );

  // A background-colored ring keeps overlapping circles visually distinct —
  // the `border` modifier always draws a rectangle regardless of `clip()`,
  // so it can't be used to outline a circular avatar.
  return (
    <Box
      contentAlignment="center"
      modifiers={[
        size(ringSize, ringSize),
        clip(Shapes.RoundedCorner(ringSize / 2)),
        background(colors.background),
      ]}
    >
      {inner}
    </Box>
  );
}
