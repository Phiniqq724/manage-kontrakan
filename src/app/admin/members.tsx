import ArrowBack from "@expo/material-symbols/arrow_back.xml";
import Info from "@expo/material-symbols/info.xml";
import { Host } from "@expo/ui";
import {
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
  clip,
  fillMaxSize,
  fillMaxWidth,
  padding,
  paddingAll,
  Shapes,
  verticalScroll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { router } from "expo-router";

const STEPS = [
  {
    num: "01",
    title: "Buat akun di Supabase",
    desc: "Buka Supabase dashboard → Authentication → Users → Add user. Masukkan email dan password sementara untuk penghuni baru.",
  },
  {
    num: "02",
    title: "Tambahkan data profil",
    desc: "Setelah akun dibuat, buka tabel public.users di Supabase → Insert row. Isi kolom id (salin dari auth.users), fullname, username, email, password, contact, dan role.",
  },
  {
    num: "03",
    title: "Penghuni bisa langsung login",
    desc: "Setelah kedua langkah di atas selesai, penghuni bisa login menggunakan email dan password yang sudah diatur.",
  },
];

export default function AdminMembersScreen() {
  const colors = useMaterialColors();

  return (
    <Host style={{ flex: 1 }}>
      <Column
        verticalArrangement={{ spacedBy: 16 }}
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
              Tambah penghuni
            </Text>
            <Text
              style={{ typography: "bodySmall" }}
              color={colors.onSurfaceVariant}
            >
              Panduan daftarkan anggota baru
            </Text>
          </Column>
        </Row>

        <Column>
          {STEPS.map((step, i) => (
            <Column key={step.num}>
              <Row
                horizontalArrangement={{ spacedBy: 16 }}
                modifiers={[fillMaxWidth(), padding(0, 14, 0, 14)]}
              >
                <Text
                  style={{ typography: "titleMedium", fontWeight: "bold" }}
                  color={colors.primary}
                >
                  {step.num}
                </Text>
                <Column
                  verticalArrangement={{ spacedBy: 4 }}
                  modifiers={[weight(1)]}
                >
                  <Text
                    style={{ typography: "bodyLarge", fontWeight: "600" }}
                    color={colors.onSurface}
                  >
                    {step.title}
                  </Text>
                  <Text
                    style={{ typography: "bodyMedium" }}
                    color={colors.onSurfaceVariant}
                  >
                    {step.desc}
                  </Text>
                </Column>
              </Row>
              {i < STEPS.length - 1 && (
                <HorizontalDivider color={colors.outlineVariant} />
              )}
            </Column>
          ))}
        </Column>

        <Row
          horizontalArrangement={{ spacedBy: 12 }}
          modifiers={[
            fillMaxWidth(),
            clip(Shapes.RoundedCorner(16)),
            background(colors.secondaryContainer),
            paddingAll(16),
          ]}
        >
          <Icon source={Info} tint={colors.onSecondaryContainer} size={18} />
          <Text
            style={{ typography: "bodySmall" }}
            color={colors.onSecondaryContainer}
            modifiers={[weight(1)]}
          >
            Proses ini dilakukan manual di Supabase dashboard untuk menjaga
            keamanan — password tidak pernah diproses lewat aplikasi.
          </Text>
        </Row>
      </Column>
    </Host>
  );
}
