import { Box, RNHostView, Text, type MaterialColors } from "@expo/ui/jetpack-compose";
import { background, clip, Shapes, size } from "@expo/ui/jetpack-compose/modifiers";
import { Image } from "react-native";

export type AvatarColorPair = { bg: string; fg: string };

/** Deterministically picks a container/on-container color pair for an avatar fallback, for visual variety across a list of people. */
export function avatarColorFor(seed: string, colors: MaterialColors): AvatarColorPair {
  const palette: AvatarColorPair[] = [
    { bg: colors.primaryContainer, fg: colors.onPrimaryContainer },
    { bg: colors.secondaryContainer, fg: colors.onSecondaryContainer },
    { bg: colors.tertiaryContainer, fg: colors.onTertiaryContainer },
    { bg: colors.errorContainer, fg: colors.onErrorContainer },
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

export function Avatar({
  fullname,
  avatarUrl,
  diameter,
  colors,
}: {
  fullname: string;
  avatarUrl?: string | null;
  diameter: number;
  colors: AvatarColorPair;
}) {
  const radius = diameter / 2;

  if (avatarUrl) {
    return (
      <Box modifiers={[size(diameter, diameter), clip(Shapes.RoundedCorner(radius))]}>
        <RNHostView>
          <Image
            source={{ uri: avatarUrl }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        </RNHostView>
      </Box>
    );
  }

  return (
    <Box
      contentAlignment="center"
      modifiers={[size(diameter, diameter), clip(Shapes.RoundedCorner(radius)), background(colors.bg)]}
    >
      <Text
        style={{ typography: diameter >= 32 ? "titleMedium" : "labelSmall", fontWeight: "bold" }}
        color={colors.fg}
      >
        {fullname[0]?.toUpperCase() ?? "?"}
      </Text>
    </Box>
  );
}
