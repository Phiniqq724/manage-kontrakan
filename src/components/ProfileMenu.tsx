import { useAppColors } from "@/components/AppHost";
import { Avatar } from "@/components/Avatar";
import { ReportIssueSheet } from "@/components/ReportIssueSheet";
import { useAccountActions } from "@/utils/account-actions";
import { useAuth } from "@/utils/auth-context";
import { getLinkedSession } from "@/utils/multi-session";
import Flag from "@expo/material-symbols/flag.xml";
import Logout from "@expo/material-symbols/logout.xml";
import Person from "@expo/material-symbols/person.xml";
import Settings from "@expo/material-symbols/settings.xml";
import SwapHoriz from "@expo/material-symbols/swap_horiz.xml";
import {
  Box,
  DropdownMenu,
  DropdownMenuItem,
  Icon,
  Text,
} from "@expo/ui/jetpack-compose";
import {
  clickable,
  clip,
  matchParentSize,
  Shapes,
} from "@expo/ui/jetpack-compose/modifiers";
import { router, type Href } from "expo-router";
import { useRef, useState } from "react";
import type { ImageSourcePropType } from "react-native";

/**
 * The avatar in Beranda's header. Tapping it opens a menu: Profil, Pengaturan,
 * Laporan, Ganti akun (only when a linked account is stored on this phone)
 * and Keluar.
 */
export const ProfileMenu = () => {
  const colors = useAppColors();
  const { user } = useAuth();
  const { logout, switchAccount } = useAccountActions();
  const [open, setOpen] = useState(false);
  const [canSwitch, setCanSwitch] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  // One choice per opening: the menu stays tappable while it fades out, so a
  // quick double tap would otherwise push Profil or Pengaturan twice.
  const chosen = useRef(false);

  if (!user) return null;

  const openMenu = () => {
    chosen.current = false;
    setOpen(true);
    getLinkedSession()
      .then((s) => setCanSwitch(!!s))
      .catch(() => setCanSwitch(false));
  };

  // Closes the menu first so it never lingers over the next screen.
  const choose = (action: () => void | Promise<void>) => async () => {
    if (chosen.current) return;
    chosen.current = true;
    setOpen(false);
    try {
      await action();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const items: [string, ImageSourcePropType, () => void | Promise<void>][] = [
    ["Profil", Person, () => router.push("/profile")],
    ["Pengaturan", Settings, () => router.push("/settings" as Href)],
    ["Laporan", Flag, () => setReportOpen(true)],
    ...(canSwitch
      ? [["Ganti akun", SwapHoriz, switchAccount] as [string, ImageSourcePropType, () => Promise<void>]]
      : []),
    ["Keluar", Logout, logout],
  ];

  return (
    <>
      <DropdownMenu expanded={open} onDismissRequest={() => setOpen(false)}>
        <DropdownMenu.Trigger>
          {/* The overlay catches taps even over a photo avatar (a React Native image). */}
          <Box>
            <Avatar
              fullname={user.fullname}
              avatarUrl={user.avatar_url}
              diameter={40}
              colors={{ bg: colors.primaryContainer, fg: colors.onPrimaryContainer }}
            />
            <Box modifiers={[matchParentSize(), clip(Shapes.Circle), clickable(openMenu)]} />
          </Box>
        </DropdownMenu.Trigger>
        <DropdownMenu.Items>
          {items.map(([label, icon, action]) => (
            <DropdownMenuItem key={label} onClick={choose(action)}>
              <DropdownMenuItem.LeadingIcon>
                <Icon
                  source={icon}
                  size={20}
                  tint={label === "Keluar" ? colors.error : colors.onSurfaceVariant}
                />
              </DropdownMenuItem.LeadingIcon>
              <DropdownMenuItem.Text>
                <Text color={label === "Keluar" ? colors.error : colors.onSurface}>
                  {label}
                </Text>
              </DropdownMenuItem.Text>
            </DropdownMenuItem>
          ))}
        </DropdownMenu.Items>
      </DropdownMenu>

      {reportOpen && (
        <ReportIssueSheet
          userId={user.id}
          userFullname={user.fullname}
          onClose={() => setReportOpen(false)}
        />
      )}
    </>
  );
};
