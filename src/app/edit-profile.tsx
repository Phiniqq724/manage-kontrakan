import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Field, GhostButton, PrimaryButton, Rule, SectionHeader } from "../components/UI";
import { Colors, FontSize, Spacing } from "../constants/theme";
import { usersApi } from "../services/api";
import { supabase } from "../utils/supabase";
import { useAuth } from "../utils/auth-context";
import { captureAndUploadImage, pickAndUploadImage } from "../utils/upload";

export default function EditProfileScreen() {
  const { user, refresh } = useAuth();

  const [fullname, setFullname] = useState(user?.fullname ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [contact, setContact] = useState(user?.contact ?? "");
  const [saving, setSaving] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  if (!user) return null;

  const initials = (name: string) =>
    name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const handlePickAvatar = () => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Batal", "Ambil Foto", "Pilih dari Galeri"], cancelButtonIndex: 0 },
        async (idx) => {
          if (idx === 1) await doUploadAvatar("camera");
          if (idx === 2) await doUploadAvatar("gallery");
        },
      );
    } else {
      Alert.alert("Foto Profil", "Pilih sumber foto", [
        { text: "Batal", style: "cancel" },
        { text: "Kamera", onPress: () => doUploadAvatar("camera") },
        { text: "Galeri", onPress: () => doUploadAvatar("gallery") },
      ]);
    }
  };

  const doUploadAvatar = async (source: "camera" | "gallery") => {
    setUploadingAvatar(true);
    try {
      const url =
        source === "camera"
          ? await captureAndUploadImage("avatars", user.id)
          : await pickAndUploadImage("avatars", user.id);
      if (!url) return;
      const { error } = await usersApi.update(user.id, { avatar_url: url });
      if (error) throw error;
      await refresh();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!fullname.trim() || !username.trim()) {
      Alert.alert("Error", "Nama lengkap dan username tidak boleh kosong.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await usersApi.update(user.id, {
        fullname: fullname.trim(),
        username: username.trim(),
        contact: contact.trim() || null,
      });
      if (error) throw error;
      await refresh();
      Alert.alert("Berhasil", "Profil berhasil diperbarui.");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert("Error", "Password minimal 6 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Konfirmasi password tidak cocok.");
      return;
    }
    setChangingPw(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
      if (authError) throw authError;
      await usersApi.update(user.id, { password: newPassword });
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("Berhasil", "Password berhasil diubah.");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setChangingPw(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>EDIT PROFIL</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Avatar */}
          <TouchableOpacity
            style={styles.avatarSection}
            onPress={handlePickAvatar}
            activeOpacity={0.7}
            disabled={uploadingAvatar}
          >
            <View style={styles.avatarWrapper}>
              {user.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarText}>{initials(user.fullname)}</Text>
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <Ionicons
                  name={uploadingAvatar ? "hourglass-outline" : "camera-outline"}
                  size={14}
                  color={Colors.bg}
                />
              </View>
            </View>
            <Text style={styles.avatarHint}>
              {uploadingAvatar ? "Mengunggah..." : "Ketuk untuk ubah foto"}
            </Text>
          </TouchableOpacity>

          <Rule />

          {/* Profile info */}
          <SectionHeader label="Informasi Profil" />
          <Rule />
          <View style={styles.fields}>
            <Field
              label="Nama Lengkap"
              value={fullname}
              onChangeText={setFullname}
              placeholder="Nama lengkap"
            />
            <Field
              label="Username"
              value={username}
              onChangeText={setUsername}
              placeholder="username"
              autoCapitalize="none"
            />
            <Field
              label="Kontak (WA)"
              value={contact}
              onChangeText={setContact}
              placeholder="08xx-xxxx-xxxx"
              keyboardType="phone-pad"
            />
          </View>
          <View style={styles.actionRow}>
            <PrimaryButton
              label={saving ? "MENYIMPAN..." : "SIMPAN PROFIL"}
              onPress={handleSaveProfile}
            />
          </View>

          <Rule style={{ marginTop: Spacing.lg }} />

          {/* Change password */}
          <SectionHeader label="Ubah Password" />
          <Rule />
          <View style={styles.fields}>
            <Field
              label="Password Baru"
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Min. 6 karakter"
              secureTextEntry
            />
            <Field
              label="Konfirmasi Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Ulangi password baru"
              secureTextEntry
            />
          </View>
          <View style={styles.actionRow}>
            <GhostButton
              label={changingPw ? "MENGUBAH..." : "UBAH PASSWORD"}
              onPress={handleChangePassword}
            />
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.lg,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  content: { paddingBottom: Spacing.xl },
  avatarSection: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  avatarWrapper: { position: "relative" },
  avatarImg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
  },
  avatarFallback: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.xl,
    color: Colors.accent,
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarHint: { fontSize: FontSize.sm, color: Colors.textMuted },
  fields: { paddingHorizontal: Spacing.md, gap: Spacing.xs },
  actionRow: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
});
