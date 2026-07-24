import { Avatar, avatarColorFor } from "@/components/Avatar";
import { ButtonContent } from "@/components/ButtonContent";
import {
  formatPaymentPeriod,
  isPayable,
  PayFormSheet,
  PAYMENT_STATUS_LABEL,
  PaymentDetailSheet,
  PaymentsListSheet,
  type PaymentRow,
} from "@/components/PaymentsSheets";
import { appReleasesApi, kamarApi, paymentsApi, usersApi } from "@/services/api";
import { isNewerVersion } from "@/utils/app-update";
import { signOut } from "@/utils/auth";
import { useAuth } from "@/utils/auth-context";
import { seedTextField } from "@/utils/seed-text-field";
import { supabase } from "@/utils/supabase";
import type { Database } from "@/utils/supabase-types";
import { captureAndUploadImage, pickAndUploadImage } from "@/utils/upload";
import AdminPanelSettings from "@expo/material-symbols/admin_panel_settings.xml";
import ArrowBack from "@expo/material-symbols/arrow_back.xml";
import CheckCircle from "@expo/material-symbols/check_circle.xml";
import ChevronRight from "@expo/material-symbols/chevron_right.xml";
import Close from "@expo/material-symbols/close.xml";
import Edit from "@expo/material-symbols/edit.xml";
import SystemUpdate from "@expo/material-symbols/system_update_alt.xml";
import Logout from "@expo/material-symbols/logout.xml";
import PhotoCamera from "@expo/material-symbols/photo_camera.xml";
import PhotoLibrary from "@expo/material-symbols/photo_library.xml";
import { Host } from "@expo/ui";
import type { TextFieldRef } from "@expo/ui/jetpack-compose";
import {
  Box,
  Button,
  Column,
  FilledIconButton,
  HorizontalDivider,
  Icon,
  IconButton,
  ModalBottomSheet,
  OutlinedButton,
  OutlinedCard,
  OutlinedTextField,
  PullToRefreshBox,
  Row,
  Shape,
  Text,
  TextButton,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  align,
  background,
  clickable,
  clip,
  fillMaxSize,
  fillMaxWidth,
  imePadding,
  padding,
  paddingAll,
  Shapes,
  size,
  verticalScroll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import Constants from "expo-constants";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";

type UserRow = Database["public"]["Tables"]["users"]["Row"];
type KamarRow = Database["public"]["Tables"]["kamar"]["Row"];
type AppReleaseRow = Database["public"]["Tables"]["app_releases"]["Row"];

const CURRENT_VERSION = Constants.expoConfig?.version ?? "—";

function kamarLabel(k: KamarRow | null) {
  if (!k) return null;
  return k.description ? `${k.room_code} · ${k.description}` : k.room_code;
}

export default function ProfileScreen() {
  const { user, refresh } = useAuth();
  const colors = useMaterialColors();

  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [kamar, setKamar] = useState<KamarRow | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [passwordSheetOpen, setPasswordSheetOpen] = useState(false);
  const [kamarSheetOpen, setKamarSheetOpen] = useState(false);
  const [tagihanSheetOpen, setTagihanSheetOpen] = useState(false);
  const [detailPayment, setDetailPayment] = useState<PaymentRow | null>(null);
  const [payFormPayment, setPayFormPayment] = useState<PaymentRow | null>(null);
  const [latestRelease, setLatestRelease] = useState<AppReleaseRow | null>(null);

  useEffect(() => {
    if (user?.id) loadData();
  }, [user?.id]);

  async function loadData() {
    if (!user) return;
    const [payRes, kamarRes, releaseRes] = await Promise.all([
      paymentsApi.getByUser(user.id),
      kamarApi.getByUser(user.id),
      appReleasesApi.getLatest(),
    ]);
    if (payRes.data) {
      setPayments(payRes.data.sort((a, b) => b.period.localeCompare(a.period)));
    }
    setKamar(kamarRes.data ?? null);
    setLatestRelease(releaseRes.data ?? null);
  }

  const closeAllPaymentSheets = () => {
    setTagihanSheetOpen(false);
    setDetailPayment(null);
    setPayFormPayment(null);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  };

  const handleLogout = async () => {
    await signOut();
    router.replace("/auth/login");
  };

  if (!user) return null;

  const actionablePayment = payments.find((p) => isPayable(p.status));

  return (
    <Host style={{ flex: 1 }}>
      <PullToRefreshBox
        isRefreshing={refreshing}
        onRefresh={onRefresh}
        contentAlignment="topCenter"
        modifiers={[fillMaxSize(), background(colors.background)]}
      >
        <Column
          verticalArrangement={{ spacedBy: 20 }}
          modifiers={[fillMaxSize(), verticalScroll(), padding(16, 56, 16, 32)]}
        >
          {/* Header */}
          <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
            <IconButton onClick={() => router.back()}>
              <Icon source={ArrowBack} tint={colors.onSurface} size={22} />
            </IconButton>
            <Text
              style={{
                typography: "titleLarge",
                fontWeight: "bold",
                textAlign: "center",
              }}
              color={colors.onBackground}
              modifiers={[weight(1)]}
            >
              Profil
            </Text>
            <IconButton onClick={() => setEditOpen(true)}>
              <Icon source={Edit} tint={colors.onSurface} size={20} />
            </IconButton>
          </Row>

          {/* Avatar */}
          <Column
            horizontalAlignment="center"
            verticalArrangement={{ spacedBy: 6 }}
            modifiers={[fillMaxWidth()]}
          >
            <Avatar
              fullname={user.fullname}
              avatarUrl={user.avatar_url}
              diameter={88}
              colors={avatarColorFor(user.id, colors)}
            />
            <Text
              style={{ typography: "headlineSmall", fontWeight: "bold" }}
              color={colors.onBackground}
            >
              {user.fullname}
            </Text>
            <Text
              style={{ typography: "bodyMedium" }}
              color={colors.onSurfaceVariant}
            >
              {`${user.username} · ${user.email}`}
            </Text>
          </Column>

          {/* Info */}
          <OutlinedCard modifiers={[fillMaxWidth()]}>
            <Column modifiers={[fillMaxWidth()]}>
              <InfoRow label="Username" value={user.username} />
              <HorizontalDivider color={colors.outlineVariant} />
              <InfoRow label="Kontak" value={user.contact ?? "-"} />
              <HorizontalDivider color={colors.outlineVariant} />
              <InfoRow
                label="Kamar"
                value={kamarLabel(kamar) ?? "Belum ada kamar"}
                onClick={kamar ? () => setKamarSheetOpen(true) : undefined}
              />
            </Column>
          </OutlinedCard>

          {/* Tagihan */}
          <Row
            verticalAlignment="center"
            horizontalArrangement="spaceBetween"
            modifiers={[
              fillMaxWidth(),
              clip(Shapes.RoundedCorner(18)),
              background(colors.surfaceContainerLow),
              clickable(() => setTagihanSheetOpen(true)),
              paddingAll(16),
            ]}
          >
            <Column
              verticalArrangement={{ spacedBy: 2 }}
              modifiers={[weight(1)]}
            >
              <Text
                style={{ typography: "bodyLarge", fontWeight: "bold" }}
                color={colors.onSurface}
              >
                Tagihan
              </Text>
              <Text
                style={{ typography: "bodySmall" }}
                color={colors.onSurfaceVariant}
                overflow="ellipsis"
                maxLines={1}
              >
                {actionablePayment
                  ? `${PAYMENT_STATUS_LABEL[actionablePayment.status] ?? actionablePayment.status} · ${formatPaymentPeriod(actionablePayment.period)}`
                  : "Semua tagihan lunas"}
              </Text>
            </Column>
            <Icon
              source={ChevronRight}
              tint={colors.onSurfaceVariant}
              size={20}
            />
          </Row>

          {user.role === "admin" && (
            <Row
              verticalAlignment="center"
              horizontalArrangement="spaceBetween"
              modifiers={[
                fillMaxWidth(),
                clip(Shapes.RoundedCorner(18)),
                background(colors.surfaceContainerLow),
                clickable(() => router.push("/admin" as any)),
                paddingAll(16),
              ]}
            >
              <Row
                verticalAlignment="center"
                horizontalArrangement={{ spacedBy: 12 }}
              >
                <Icon
                  source={AdminPanelSettings}
                  tint={colors.onSurfaceVariant}
                  size={22}
                />
                <Text
                  style={{ typography: "bodyLarge", fontWeight: "bold" }}
                  color={colors.onSurface}
                >
                  Panel Admin
                </Text>
              </Row>
              <Icon
                source={ChevronRight}
                tint={colors.onSurfaceVariant}
                size={20}
              />
            </Row>
          )}

          <AppVersionCard latest={latestRelease} />

          <OutlinedButton onClick={handleLogout} modifiers={[fillMaxWidth()]}>
            <Row
              verticalAlignment="center"
              horizontalArrangement={{ spacedBy: 8 }}
            >
              <Icon source={Logout} tint={colors.onSurface} size={18} />
              <Text
                style={{ typography: "labelLarge", fontWeight: "bold" }}
                color={colors.onSurface}
              >
                Keluar
              </Text>
            </Row>
          </OutlinedButton>
        </Column>
      </PullToRefreshBox>

      {editOpen && (
        <EditProfileSheet
          user={user}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            refresh();
            setEditOpen(false);
          }}
          onChangePassword={() => {
            setEditOpen(false);
            setPasswordSheetOpen(true);
          }}
          onAvatarUpdated={refresh}
        />
      )}

      {passwordSheetOpen && (
        <ChangePasswordSheet
          userId={user.id}
          onClose={() => setPasswordSheetOpen(false)}
        />
      )}

      {kamarSheetOpen && kamar && (
        <EditKamarSheet
          kamar={kamar}
          onClose={() => setKamarSheetOpen(false)}
          onSaved={(desc) =>
            setKamar((prev) => (prev ? { ...prev, description: desc } : prev))
          }
        />
      )}

      {tagihanSheetOpen && (
        <PaymentsListSheet
          payments={payments}
          onClose={closeAllPaymentSheets}
          onSelect={(p) => {
            setTagihanSheetOpen(false);
            setDetailPayment(p);
          }}
          onPay={(p) => {
            setTagihanSheetOpen(false);
            setPayFormPayment(p);
          }}
        />
      )}

      {detailPayment && (
        <PaymentDetailSheet
          payment={detailPayment}
          onClose={closeAllPaymentSheets}
          onPay={(p) => {
            setDetailPayment(null);
            setPayFormPayment(p);
          }}
        />
      )}

      {payFormPayment && (
        <PayFormSheet
          payment={payFormPayment}
          userId={user.id}
          userFullname={user.fullname}
          onClose={closeAllPaymentSheets}
          onSubmitted={() => {
            loadData();
            closeAllPaymentSheets();
          }}
        />
      )}
    </Host>
  );
}

function InfoRow({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick?: () => void;
}) {
  const colors = useMaterialColors();
  return (
    <Row
      verticalAlignment="center"
      horizontalArrangement="spaceBetween"
      modifiers={[
        fillMaxWidth(),
        ...(onClick ? [clickable(onClick)] : []),
        padding(16, 14, 16, 14),
      ]}
    >
      <Text
        style={{ typography: "bodyMedium" }}
        color={colors.onSurfaceVariant}
      >
        {label}
      </Text>
      <Row
        verticalAlignment="center"
        horizontalArrangement={{ spacedBy: 4 }}
        modifiers={[weight(1)]}
      >
        <Text
          style={{
            typography: "bodyMedium",
            fontWeight: "600",
            textAlign: "right",
          }}
          color={colors.onSurface}
          overflow="ellipsis"
          maxLines={1}
          modifiers={[weight(1)]}
        >
          {value}
        </Text>
        {onClick && (
          <Icon
            source={ChevronRight}
            tint={colors.onSurfaceVariant}
            size={16}
          />
        )}
      </Row>
    </Row>
  );
}

function AppVersionCard({ latest }: { latest: AppReleaseRow | null }) {
  const colors = useMaterialColors();
  const [opening, setOpening] = useState(false);
  const updateAvailable =
    !!latest && isNewerVersion(CURRENT_VERSION, latest.version);

  const handleDownload = async () => {
    if (!latest?.apk_url) return;
    setOpening(true);
    try {
      await WebBrowser.openBrowserAsync(latest.apk_url);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setOpening(false);
    }
  };

  return (
    <OutlinedCard modifiers={[fillMaxWidth()]}>
      <Column
        verticalArrangement={{ spacedBy: 12 }}
        modifiers={[fillMaxWidth(), paddingAll(16)]}
      >
        <Row
          verticalAlignment="center"
          horizontalArrangement={{ spacedBy: 12 }}
          modifiers={[fillMaxWidth()]}
        >
          <Icon
            source={updateAvailable ? SystemUpdate : CheckCircle}
            tint={updateAvailable ? colors.primary : colors.onSurfaceVariant}
            size={22}
          />
          <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[weight(1)]}>
            <Text
              style={{ typography: "bodyLarge", fontWeight: "bold" }}
              color={colors.onSurface}
            >
              Versi aplikasi
            </Text>
            <Text
              style={{ typography: "bodySmall" }}
              color={colors.onSurfaceVariant}
            >
              {updateAvailable
                ? `Versi ${latest!.version} tersedia · kamu di ${CURRENT_VERSION}`
                : `Kamu sudah di versi terbaru (${CURRENT_VERSION})`}
            </Text>
          </Column>
        </Row>

        {updateAvailable && !!latest?.release_notes && (
          <Text
            style={{ typography: "bodySmall" }}
            color={colors.onSurfaceVariant}
          >
            {latest.release_notes}
          </Text>
        )}

        {updateAvailable && (
          <Button
            enabled={!opening}
            onClick={handleDownload}
            modifiers={[fillMaxWidth()]}
          >
            <Row
              verticalAlignment="center"
              horizontalArrangement={{ spacedBy: 8 }}
            >
              <Icon source={SystemUpdate} tint={colors.onPrimary} size={18} />
              <Text
                style={{ typography: "labelLarge", fontWeight: "bold" }}
                color={colors.onPrimary}
              >
                Perbarui sekarang
              </Text>
            </Row>
          </Button>
        )}
      </Column>
    </OutlinedCard>
  );
}

function EditProfileSheet({
  user,
  onClose,
  onSaved,
  onChangePassword,
  onAvatarUpdated,
}: {
  user: UserRow;
  onClose: () => void;
  onSaved: () => void;
  onChangePassword: () => void;
  onAvatarUpdated: () => void;
}) {
  const colors = useMaterialColors();
  const fullnameRef = useRef<TextFieldRef>(null);
  const usernameRef = useRef<TextFieldRef>(null);
  const contactRef = useRef<TextFieldRef>(null);

  useEffect(() => {
    // Retries internally since the native view may not be registered yet
    // on mount; also can't await here since the sheet can unmount early
    // (e.g. navigating to the password sheet) before it resolves.
    seedTextField(fullnameRef, user.fullname);
    seedTextField(usernameRef, user.username ?? "");
    seedTextField(contactRef, user.contact ?? "");
    // Seed the native fields once on mount; deliberately not re-run on prop changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [fullname, setFullname] = useState(user.fullname);
  const [username, setUsername] = useState(user.username);
  const [contact, setContact] = useState(user.contact ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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
      setAvatarUrl(url);
      onAvatarUpdated();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      const { error } = await usersApi.update(user.id, { avatar_url: null });
      if (error) throw error;
      setAvatarUrl(null);
      onAvatarUpdated();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveProfile = async () => {
    if (!fullname.trim() || !username.trim()) {
      alert("Nama lengkap dan username tidak boleh kosong.");
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
      onSaved();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalBottomSheet onDismissRequest={onClose}>
      <Column
        verticalArrangement={{ spacedBy: 16 }}
        modifiers={[
          fillMaxWidth(),
          verticalScroll(),
          imePadding(),
          padding(24, 8, 24, 32),
        ]}
      >
        <Text
          style={{ typography: "headlineSmall", fontWeight: "bold" }}
          color={colors.onSurface}
        >
          Edit profil
        </Text>

        <Row
          verticalAlignment="center"
          horizontalArrangement={{ spacedBy: 16 }}
        >
          <Box modifiers={[size(72, 72)]}>
            <Avatar
              fullname={user.fullname}
              avatarUrl={avatarUrl}
              diameter={72}
              colors={avatarColorFor(user.id, colors)}
            />
            {avatarUrl && (
              <FilledIconButton
                onClick={handleRemoveAvatar}
                shape={Shape.Circle({ radius: 1 })}
                colors={{
                  containerColor: colors.error,
                  contentColor: colors.onError,
                }}
                modifiers={[align("topEnd"), size(22, 22)]}
              >
                <Icon source={Close} tint={colors.onError} size={14} />
              </FilledIconButton>
            )}
          </Box>
          <Column verticalArrangement={{ spacedBy: 8 }} modifiers={[weight(1)]}>
            <OutlinedButton
              enabled={!uploadingAvatar}
              onClick={() => doUploadAvatar("camera")}
              modifiers={[fillMaxWidth()]}
            >
              <Row
                verticalAlignment="center"
                horizontalArrangement={{ spacedBy: 6 }}
              >
                <Icon source={PhotoCamera} tint={colors.primary} size={16} />
                <Text
                  style={{ typography: "labelLarge" }}
                  color={colors.primary}
                >
                  Kamera
                </Text>
              </Row>
            </OutlinedButton>
            <OutlinedButton
              enabled={!uploadingAvatar}
              onClick={() => doUploadAvatar("gallery")}
              modifiers={[fillMaxWidth()]}
            >
              <Row
                verticalAlignment="center"
                horizontalArrangement={{ spacedBy: 6 }}
              >
                <Icon source={PhotoLibrary} tint={colors.primary} size={16} />
                <Text
                  style={{ typography: "labelLarge" }}
                  color={colors.primary}
                >
                  Galeri
                </Text>
              </Row>
            </OutlinedButton>
          </Column>
        </Row>

        <OutlinedTextField
          ref={fullnameRef}
          singleLine
          onValueChange={setFullname}
          keyboardOptions={{ capitalization: "words" }}
          modifiers={[fillMaxWidth()]}
        >
          <OutlinedTextField.Label>
            <Text>Nama lengkap</Text>
          </OutlinedTextField.Label>
        </OutlinedTextField>

        <OutlinedTextField
          ref={usernameRef}
          singleLine
          onValueChange={setUsername}
          keyboardOptions={{ capitalization: "none" }}
          modifiers={[fillMaxWidth()]}
        >
          <OutlinedTextField.Label>
            <Text>Username</Text>
          </OutlinedTextField.Label>
        </OutlinedTextField>

        <OutlinedTextField
          ref={contactRef}
          singleLine
          onValueChange={setContact}
          keyboardOptions={{ keyboardType: "phone" }}
          modifiers={[fillMaxWidth()]}
        >
          <OutlinedTextField.Label>
            <Text>Kontak (WA)</Text>
          </OutlinedTextField.Label>
        </OutlinedTextField>

        <Button
          enabled={!saving}
          onClick={handleSaveProfile}
          modifiers={[fillMaxWidth()]}
        >
          <ButtonContent loading={saving} label="Simpan profil" color={colors.onPrimary} />
        </Button>

        <HorizontalDivider color={colors.outlineVariant} />

        <OutlinedButton onClick={onChangePassword} modifiers={[fillMaxWidth()]}>
          <Text style={{ typography: "labelLarge" }} color={colors.primary}>
            Ubah password
          </Text>
        </OutlinedButton>
      </Column>
    </ModalBottomSheet>
  );
}

function ChangePasswordSheet({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const colors = useMaterialColors();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      alert("Password minimal 6 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("Konfirmasi password tidak cocok.");
      return;
    }
    setChangingPw(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (authError) throw authError;
      await usersApi.update(userId, { password: newPassword });
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setChangingPw(false);
    }
  };

  return (
    <ModalBottomSheet onDismissRequest={onClose}>
      <Column
        verticalArrangement={{ spacedBy: 16 }}
        modifiers={[
          fillMaxWidth(),
          verticalScroll(),
          imePadding(),
          padding(24, 8, 24, 32),
        ]}
      >
        <Text
          style={{ typography: "headlineSmall", fontWeight: "bold" }}
          color={colors.onSurface}
        >
          Ubah password
        </Text>

        <OutlinedTextField
          singleLine
          onValueChange={setNewPassword}
          visualTransformation="password"
          modifiers={[fillMaxWidth()]}
        >
          <OutlinedTextField.Label>
            <Text>Password baru</Text>
          </OutlinedTextField.Label>
        </OutlinedTextField>

        <OutlinedTextField
          singleLine
          onValueChange={setConfirmPassword}
          visualTransformation="password"
          modifiers={[fillMaxWidth()]}
        >
          <OutlinedTextField.Label>
            <Text>Konfirmasi password</Text>
          </OutlinedTextField.Label>
        </OutlinedTextField>

        <Button
          enabled={!changingPw}
          onClick={handleChangePassword}
          modifiers={[fillMaxWidth()]}
        >
          <ButtonContent loading={changingPw} label="Ubah password" color={colors.onPrimary} />
        </Button>
      </Column>
    </ModalBottomSheet>
  );
}

function EditKamarSheet({
  kamar,
  onClose,
  onSaved,
}: {
  kamar: KamarRow;
  onClose: () => void;
  onSaved: (desc: string) => void;
}) {
  const colors = useMaterialColors();
  const descRef = useRef<TextFieldRef>(null);
  const [desc, setDesc] = useState(kamar.description ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    seedTextField(descRef, kamar.description ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await kamarApi.updateDescription(kamar.id, desc);
      if (error) throw error;
      onSaved(desc);
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalBottomSheet onDismissRequest={onClose}>
      <Column
        verticalArrangement={{ spacedBy: 16 }}
        modifiers={[
          fillMaxWidth(),
          verticalScroll(),
          imePadding(),
          padding(24, 8, 24, 32),
        ]}
      >
        <Column verticalArrangement={{ spacedBy: 4 }}>
          <Text
            style={{ typography: "headlineSmall", fontWeight: "bold" }}
            color={colors.onSurface}
          >
            Deskripsi kamar
          </Text>
          <Text
            style={{ typography: "bodyMedium" }}
            color={colors.onSurfaceVariant}
          >
            {kamar.room_code}
          </Text>
        </Column>

        <OutlinedTextField
          ref={descRef}
          onValueChange={setDesc}
          minLines={2}
          keyboardOptions={{ capitalization: "sentences" }}
          modifiers={[fillMaxWidth()]}
        >
          <OutlinedTextField.Label>
            <Text>Deskripsi</Text>
          </OutlinedTextField.Label>
        </OutlinedTextField>

        <Row
          verticalAlignment="center"
          horizontalArrangement={{ spacedBy: 12 }}
          modifiers={[fillMaxWidth()]}
        >
          <TextButton onClick={onClose} modifiers={[weight(1)]}>
            <Text
              style={{ typography: "labelLarge" }}
              color={colors.onSurfaceVariant}
            >
              Batal
            </Text>
          </TextButton>
          <Button
            enabled={!saving}
            onClick={handleSave}
            modifiers={[weight(1)]}
          >
            <ButtonContent loading={saving} label="Simpan" color={colors.onPrimary} />
          </Button>
        </Row>
      </Column>
    </ModalBottomSheet>
  );
}
