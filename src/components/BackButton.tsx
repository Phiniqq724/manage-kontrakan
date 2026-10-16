import { useAppColors } from "@/components/AppHost";
import { useInPager } from "@/utils/pager";
import ArrowBack from "@expo/material-symbols/arrow_back.xml";
import { Icon, IconButton } from "@expo/ui/jetpack-compose";
import { router } from "expo-router";

/** Header back arrow. Hidden when the page sits in the swiper (navbar). */
export const BackButton = () => {
  const colors = useAppColors();
  if (useInPager()) return null;
  return (
    <IconButton onClick={() => router.back()}>
      <Icon source={ArrowBack} tint={colors.onSurface} size={22} />
    </IconButton>
  );
};
