import AccountBalanceWallet from "@expo/material-symbols/account_balance_wallet.xml";
import ArrowBack from "@expo/material-symbols/arrow_back.xml";
import Campaign from "@expo/material-symbols/campaign.xml";
import ChevronRight from "@expo/material-symbols/chevron_right.xml";
import Description from "@expo/material-symbols/description.xml";
import Flag from "@expo/material-symbols/flag.xml";
import Home from "@expo/material-symbols/home.xml";
import PersonAdd from "@expo/material-symbols/person_add.xml";
import { Host } from "@expo/ui";
import {
  Box,
  Column,
  HorizontalDivider,
  Icon,
  IconButton,
  Row,
  Text,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  background,
  clickable,
  clip,
  fillMaxSize,
  fillMaxWidth,
  padding,
  Shapes,
  size,
  verticalScroll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { router } from "expo-router";
import type { ImageSourcePropType } from "react-native";

const MENU: {
  label: string;
  sub: string;
  icon: ImageSourcePropType;
  route: string;
}[] = [
  {
    label: "Konfirmasi Pembayaran",
    sub: "Terima atau tolak bukti transfer",
    icon: AccountBalanceWallet,
    route: "/admin/payments",
  },
  {
    label: "Approve Peraturan",
    sub: "Tinjau usulan peraturan baru",
    icon: Description,
    route: "/admin/rules",
  },
  {
    label: "Laporan Penghuni",
    sub: "Lihat semua laporan yang masuk",
    icon: Flag,
    route: "/admin/reports",
  },
  {
    label: "Tambah Penghuni",
    sub: "Daftarkan anggota kontrakan baru",
    icon: PersonAdd,
    route: "/admin/members",
  },
  {
    label: "Kelola Kamar",
    sub: "Tugaskan penghuni ke kamar masing-masing",
    icon: Home,
    route: "/admin/kamar",
  },
  {
    label: "Kelola Changelog",
    sub: "Tambah pembaruan dan notifikasi semua penghuni",
    icon: Campaign,
    route: "/admin/changelog",
  },
];

export default function AdminIndex() {
  const colors = useMaterialColors();

  return (
    <Host style={{ flex: 1 }}>
      <Column
        verticalArrangement={{ spacedBy: 20 }}
        modifiers={[
          fillMaxSize(),
          background(colors.background),
          verticalScroll(),
          padding(16, 56, 16, 32),
        ]}
      >
        <Row
          verticalAlignment="center"
          horizontalArrangement={{ spacedBy: 4 }}
          modifiers={[fillMaxWidth()]}
        >
          <IconButton onClick={() => router.back()}>
            <Icon source={ArrowBack} tint={colors.onSurface} size={22} />
          </IconButton>
          <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[weight(1)]}>
            <Text
              style={{ typography: "titleLarge", fontWeight: "bold" }}
              color={colors.onBackground}
            >
              Panel admin
            </Text>
            <Text
              style={{ typography: "bodySmall" }}
              color={colors.onSurfaceVariant}
            >
              Administrasi kontrakan
            </Text>
          </Column>
        </Row>

        <Column>
          {MENU.map((item, i) => (
            <Column key={item.route}>
              <Row
                verticalAlignment="center"
                horizontalArrangement={{ spacedBy: 12 }}
                modifiers={[
                  fillMaxWidth(),
                  clickable(() => router.push(item.route as any)),
                  padding(0, 14, 0, 14),
                ]}
              >
                <Box
                  contentAlignment="center"
                  modifiers={[
                    size(40, 40),
                    clip(Shapes.RoundedCorner(20)),
                    background(colors.secondaryContainer),
                  ]}
                >
                  <Icon
                    source={item.icon}
                    tint={colors.onSecondaryContainer}
                    size={20}
                  />
                </Box>
                <Column
                  verticalArrangement={{ spacedBy: 2 }}
                  modifiers={[weight(1)]}
                >
                  <Text
                    style={{ typography: "bodyLarge", fontWeight: "600" }}
                    color={colors.onSurface}
                  >
                    {item.label}
                  </Text>
                  <Text
                    style={{ typography: "bodySmall" }}
                    color={colors.onSurfaceVariant}
                  >
                    {item.sub}
                  </Text>
                </Column>
                <Icon
                  source={ChevronRight}
                  tint={colors.onSurfaceVariant}
                  size={18}
                />
              </Row>
              {i < MENU.length - 1 && (
                <HorizontalDivider color={colors.outlineVariant} />
              )}
            </Column>
          ))}
        </Column>
      </Column>
    </Host>
  );
}
