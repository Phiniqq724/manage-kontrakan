import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PageHeader, Rule } from "../../components/UI";
import { Colors, FontSize, Spacing } from "../../constants/theme";

export default function AdminMembersScreen() {
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <PageHeader title="TAMBAH PENGHUNI" subtitle="Panduan daftarkan anggota baru" />
        </View>

        <Rule />

        <View style={styles.step}>
          <Text style={styles.stepNum}>01</Text>
          <View style={styles.stepBody}>
            <Text style={styles.stepTitle}>Buat akun di Supabase</Text>
            <Text style={styles.stepDesc}>
              Buka Supabase dashboard → Authentication → Users → Add user. Masukkan email dan password sementara untuk penghuni baru.
            </Text>
          </View>
        </View>

        <Rule />

        <View style={styles.step}>
          <Text style={styles.stepNum}>02</Text>
          <View style={styles.stepBody}>
            <Text style={styles.stepTitle}>Tambahkan data profil</Text>
            <Text style={styles.stepDesc}>
              Setelah akun dibuat, buka tabel <Text style={styles.mono}>public.users</Text> di Supabase → Insert row. Isi kolom id (salin dari auth.users), fullname, username, email, password, contact, dan role.
            </Text>
          </View>
        </View>

        <Rule />

        <View style={styles.step}>
          <Text style={styles.stepNum}>03</Text>
          <View style={styles.stepBody}>
            <Text style={styles.stepTitle}>Penghuni bisa langsung login</Text>
            <Text style={styles.stepDesc}>
              Setelah kedua langkah di atas selesai, penghuni bisa login menggunakan email dan password yang sudah diatur.
            </Text>
          </View>
        </View>

        <Rule />

        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.noteText}>
            Proses ini dilakukan manual di Supabase dashboard untuk menjaga keamanan — password tidak pernah diproses lewat aplikasi.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingBottom: Spacing.xl },
  headerRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  backBtn: { paddingLeft: Spacing.md, paddingTop: Spacing.lg },
  step: {
    flexDirection: "row",
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  stepNum: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.lg,
    color: Colors.accent,
    width: 32,
  },
  stepBody: { flex: 1, gap: Spacing.xs },
  stepTitle: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.base,
    color: Colors.text,
  },
  stepDesc: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  mono: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.xs,
    color: Colors.accent,
  },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    margin: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  noteText: { flex: 1, fontSize: FontSize.sm, color: Colors.textMuted, lineHeight: 18 },
});
