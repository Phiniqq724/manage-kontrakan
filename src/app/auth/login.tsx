import { ButtonContent } from "@/components/ButtonContent";
import { SemanggiIcon } from "@/components/SemanggiIcon";
import { signIn } from "@/utils/auth";
import { supabase } from "@/utils/supabase";
import { Host } from "@expo/ui";
import {
  Box,
  Button,
  Checkbox,
  Column,
  LinearWavyProgressIndicator,
  ModalBottomSheet,
  OutlinedTextField,
  RNHostView,
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
  height,
  imePadding,
  padding,
  Shapes,
  size,
  toggleable,
  verticalScroll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Converts a local ("08...") phone number into the international format wa.me expects. */
function toWhatsAppNumber(contact: string): string {
  return contact.replace(/^0/, "62");
}

function friendlyError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials"))
    return "Email atau password salah.";
  if (m.includes("email not confirmed")) return "Email belum dikonfirmasi.";
  if (m.includes("too many requests"))
    return "Terlalu banyak percobaan. Coba lagi nanti.";
  if (m.includes("network") || m.includes("fetch"))
    return "Koneksi gagal. Periksa internet kamu.";
  return msg;
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const colors = useMaterialColors();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [adminContact, setAdminContact] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("admin_contact")
      .select("contact")
      .single()
      .then(({ data }) => setAdminContact(data?.contact ?? null));
  }, []);

  const contactAdmin = () => {
    if (!adminContact) return;
    Linking.openURL(`https://wa.me/${toWhatsAppNumber(adminContact)}`);
  };

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      router.replace("/(tabs)/dashboard" as any);
    } catch (err: any) {
      setError(friendlyError(err?.message ?? "Terjadi kesalahan."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Host style={{ flex: 1 }}>
      <Column
        horizontalAlignment="center"
        modifiers={[
          fillMaxSize(),
          background(colors.background),
          padding(24, insets.top + 32, 24, insets.bottom + 24),
        ]}
      >
        {/* Hero */}
        <Column
          horizontalAlignment="center"
          verticalArrangement={{ spacedBy: 12 }}
          modifiers={[fillMaxWidth(), weight(1)]}
        >
          <Box
            contentAlignment="center"
            modifiers={[
              size(72, 72),
              clip(Shapes.RoundedCorner(20)),
              background(colors.primaryContainer),
            ]}
          >
            <RNHostView>
              <SemanggiIcon size={72} color={colors.onPrimaryContainer} />
            </RNHostView>
          </Box>
          <Text
            style={{
              typography: "headlineMedium",
              fontWeight: "bold",
              textAlign: "center",
            }}
            color={colors.onBackground}
          >
            Semanggi
          </Text>
          <Text
            style={{ typography: "bodyMedium", textAlign: "center" }}
            color={colors.onSurfaceVariant}
          >
            Rumah bersama, tertib bersama.
          </Text>
        </Column>

        {/* CTA */}
        <Column
          verticalArrangement={{ spacedBy: 16 }}
          modifiers={[fillMaxWidth()]}
        >
          <Button
            onClick={() => setSheetOpen(true)}
            modifiers={[fillMaxWidth(), height(56)]}
          >
            <Text
              style={{ typography: "labelLarge", fontWeight: "bold" }}
              color={colors.onPrimary}
            >
              Masuk ke Semanggi
            </Text>
          </Button>
          <Row
            horizontalArrangement="center"
            verticalAlignment="center"
            modifiers={[fillMaxWidth()]}
          >
            <Text
              style={{ typography: "bodyMedium" }}
              color={colors.onSurfaceVariant}
            >
              {"Belum punya akun? "}
            </Text>
            <Text
              color={colors.primary}
              style={{ typography: "bodyMedium", fontWeight: "700" }}
              modifiers={[clickable(contactAdmin)]}
            >
              Hubungi admin
            </Text>
          </Row>
          <LinearWavyProgressIndicator modifiers={[fillMaxWidth()]} />
        </Column>
      </Column>

      {sheetOpen && (
        <ModalBottomSheet onDismissRequest={() => setSheetOpen(false)}>
          <Column
            verticalArrangement={{ spacedBy: 16 }}
            modifiers={[
              fillMaxWidth(),
              verticalScroll(),
              imePadding(),
              padding(24, 8, 24, insets.bottom + 24),
            ]}
          >
            <Column verticalArrangement={{ spacedBy: 4 }}>
              <Text
                style={{ typography: "headlineSmall", fontWeight: "bold" }}
                color={colors.onSurface}
              >
                Masuk
              </Text>
              <Text
                style={{ typography: "bodyMedium" }}
                color={colors.onSurfaceVariant}
              >
                Selamat datang kembali di Semanggi.
              </Text>
            </Column>

            <OutlinedTextField
              singleLine
              autoFocus
              enabled={!loading}
              onValueChange={setEmail}
              keyboardOptions={{
                keyboardType: "email",
                capitalization: "none",
                imeAction: "next",
              }}
              modifiers={[fillMaxWidth()]}
            >
              <OutlinedTextField.Label>
                <Text>Email</Text>
              </OutlinedTextField.Label>
            </OutlinedTextField>

            <Column verticalArrangement={{ spacedBy: 6 }}>
              <OutlinedTextField
                singleLine
                enabled={!loading}
                onValueChange={setPassword}
                visualTransformation={showPassword ? "none" : "password"}
                keyboardOptions={{
                  keyboardType: "password",
                  imeAction: "done",
                }}
                keyboardActions={{ onDone: () => handleLogin() }}
                modifiers={[fillMaxWidth()]}
              >
                <OutlinedTextField.Label>
                  <Text>Password</Text>
                </OutlinedTextField.Label>
              </OutlinedTextField>

              <Row
                verticalAlignment="center"
                horizontalArrangement="spaceBetween"
                modifiers={[fillMaxWidth()]}
              >
                <Row
                  verticalAlignment="center"
                  horizontalArrangement={{ spacedBy: 8 }}
                  modifiers={[
                    toggleable(showPassword, () => setShowPassword((v) => !v), {
                      role: "checkbox",
                    }),
                  ]}
                >
                  <Checkbox value={showPassword} />
                  <Text
                    style={{ typography: "bodyMedium" }}
                    color={colors.onSurfaceVariant}
                  >
                    Tampilkan password
                  </Text>
                </Row>

                <Text
                  style={{ typography: "labelLarge", fontWeight: "600" }}
                  color={colors.primary}
                >
                  Lupa password?
                </Text>
              </Row>
            </Column>

            {error && (
              <Text style={{ typography: "bodySmall" }} color={colors.error}>
                {error}
              </Text>
            )}

            <Button
              enabled={!loading}
              onClick={handleLogin}
              modifiers={[fillMaxWidth(), height(56)]}
            >
              <ButtonContent
                loading={loading}
                label="Masuk"
                color={colors.onPrimary}
              />
            </Button>
          </Column>
        </ModalBottomSheet>
      )}
    </Host>
  );
}
