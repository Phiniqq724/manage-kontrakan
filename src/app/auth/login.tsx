import { signIn } from "@/utils/auth";
import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Field, PrimaryButton, Rule } from "../../components/UI";
import { Colors, FontSize, Spacing } from "../../constants/theme";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logotype */}
        <View style={styles.header}>
          <Text style={styles.wordmark}>NAUNGI.</Text>
          <Rule style={styles.wordmarkRule} />
          <Text style={styles.tagline}>Rumah bersama, tertib bersama.</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="email@kamu.com"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
          />
          {error && <Text style={styles.errorText}>{error}</Text>}
          <View style={styles.actions}>
            <PrimaryButton
              label={loading ? "MASUK..." : "MASUK"}
              onPress={handleLogin}
            />
          </View>
        </View>

        {/* Footer stamp */}
        <View style={styles.footer}>
          <Rule />
          <Text style={styles.footerText}>NAUNGI. 2026</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: 80,
    paddingBottom: Spacing.xl,
  },
  header: {
    marginBottom: Spacing.xxl,
  },
  wordmark: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.display,
    color: Colors.text,
    letterSpacing: -1,
  },
  wordmarkRule: {
    marginVertical: Spacing.sm,
    backgroundColor: Colors.text,
    height: 2,
  },
  tagline: {
    fontSize: FontSize.base,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  form: {
    flex: 1,
    justifyContent: "center",
  },
  errorText: {
    fontSize: FontSize.sm,
    color: Colors.danger,
    marginTop: Spacing.sm,
  },
  actions: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  footer: {
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  footerText: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.xs,
    color: Colors.textFaint,
    letterSpacing: 2,
    textAlign: "center",
  },
});
