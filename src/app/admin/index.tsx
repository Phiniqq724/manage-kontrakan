import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { PageHeader, Rule } from "../../components/UI";
import { Colors, FontSize, Spacing } from "../../constants/theme";

const MENU = [
  {
    label: "Konfirmasi Pembayaran",
    sub: "Terima atau tolak bukti transfer",
    icon: "wallet-outline" as const,
    route: "/admin/payments",
  },
  {
    label: "Approve Peraturan",
    sub: "Tinjau usulan peraturan baru",
    icon: "document-text-outline" as const,
    route: "/admin/rules",
  },
  {
    label: "Laporan Penghuni",
    sub: "Lihat semua laporan yang masuk",
    icon: "flag-outline" as const,
    route: "/admin/reports",
  },
  {
    label: "Tambah Penghuni",
    sub: "Daftarkan anggota kontrakan baru",
    icon: "person-add-outline" as const,
    route: "/admin/members",
  },
  {
    label: "Password Manager",
    sub: "Reset password penghuni ke default",
    icon: "key-outline" as const,
    route: "/admin/passwords",
  },
  {
    label: "Kelola Kamar",
    sub: "Tugaskan penghuni ke kamar masing-masing",
    icon: "home-outline" as const,
    route: "/admin/kamar",
  },
];

export default function AdminIndex() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PageHeader title="ADMIN" subtitle="Panel administrasi kontrakan" />

      {MENU.map((item, i) => (
        <View key={i}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.6}
          >
            <View style={styles.menuIcon}>
              <Ionicons name={item.icon} size={20} color={Colors.accent} />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuSub}>{item.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
          <Rule />
        </View>
      ))}

      <View style={{ paddingHorizontal: Spacing.md, marginTop: Spacing.lg }}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.6}
        >
          <Ionicons name="arrow-back" size={16} color={Colors.textMuted} />
          <Text style={styles.backBtnText}>KEMBALI KE APP</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingBottom: Spacing.xl },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  menuInfo: { flex: 1 },
  menuLabel: { fontSize: FontSize.base, color: Colors.text },
  menuSub: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  backBtnText: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
});
