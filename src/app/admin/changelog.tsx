import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import {
  Field,
  LogRow,
  PageHeader,
  PrimaryButton,
  Rule,
  SectionHeader,
} from "../../components/UI";
import { Colors, FontSize, Spacing } from "../../constants/theme";
import { changelogsApi } from "../../services/api";
import { useAuth } from "../../utils/auth-context";
import { getAllTokensExcept, sendPushNotification } from "../../utils/notifications";
import type { Database } from "../../utils/supabase-types";

type ChangelogRow = Database["public"]["Tables"]["changelogs"]["Row"];

export default function AdminChangelogScreen() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<ChangelogRow[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data } = await changelogsApi.getAll();
    if (data) setEntries(data);
  }

  async function handleSubmit() {
    if (!title.trim()) {
      alert("Judul pembaruan wajib diisi.");
      return;
    }
    if (!user) return;
    setSubmitting(true);
    try {
      const { data: entry, error } = await changelogsApi.create({
        title,
        description,
        created_by: user.id,
      });
      if (error) throw error;
      setTitle("");
      setDescription("");
      loadData();

      if (entry) {
        const tokens = await getAllTokensExcept(user.id);
        await Promise.all(
          tokens.map((token) =>
            sendPushNotification(token, "Update Aplikasi Baru", entry.title),
          ),
        );
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await loadData();
              setRefreshing(false);
            }}
            tintColor={Colors.accent}
          />
        }
      >
        <KeyboardAvoidingView behavior="padding">
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color={Colors.text} />
            </TouchableOpacity>
            <PageHeader title="CHANGELOG" subtitle="Tambah pembaruan aplikasi" />
          </View>

          <View style={{ paddingHorizontal: Spacing.md }}>
            <Field
              label="Judul"
              value={title}
              onChangeText={setTitle}
              placeholder="Misal: Fitur voting peraturan"
            />
            <Field
              label="Deskripsi"
              value={description}
              onChangeText={setDescription}
              placeholder="Jelaskan perubahannya (opsional)"
              multiline
              numberOfLines={3}
            />
            <PrimaryButton
              label={submitting ? "MENGIRIM..." : "TAMBAH & NOTIF SEMUA"}
              onPress={handleSubmit}
            />
          </View>
        </KeyboardAvoidingView>

        <View style={{ marginTop: Spacing.lg }}>
          <SectionHeader label={`${entries.length} Pembaruan`} />
          <Rule />
          {entries.length === 0 && (
            <Text style={styles.emptyText}>Belum ada pembaruan.</Text>
          )}
          {entries.map((entry) => (
            <LogRow
              key={entry.id}
              date={new Date(entry.created_at).toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
              title={entry.title}
              meta={entry.description ?? undefined}
            />
          ))}
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
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
});
