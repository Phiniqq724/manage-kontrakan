import { ButtonContent } from "@/components/ButtonContent";
import { changelogsApi } from "@/services/api";
import { useAuth } from "@/utils/auth-context";
import { getAllTokensExcept, sendPushNotification } from "@/utils/notifications";
import type { Database } from "@/utils/supabase-types";
import ArrowBack from "@expo/material-symbols/arrow_back.xml";
import { Host } from "@expo/ui";
import type { TextFieldRef } from "@expo/ui/jetpack-compose";
import {
  Button,
  Column,
  HorizontalDivider,
  Icon,
  IconButton,
  OutlinedTextField,
  PullToRefreshBox,
  Row,
  Text,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  background,
  fillMaxSize,
  fillMaxWidth,
  imePadding,
  padding,
  verticalScroll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";

type ChangelogRow = Database["public"]["Tables"]["changelogs"]["Row"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function AdminChangelogScreen() {
  const { user } = useAuth();
  const colors = useMaterialColors();
  const titleRef = useRef<TextFieldRef>(null);
  const descRef = useRef<TextFieldRef>(null);

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

  const onRefresh = () => {
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  };

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
      titleRef.current?.clear().catch(() => {});
      descRef.current?.clear().catch(() => {});
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
    <Host style={{ flex: 1 }}>
      <PullToRefreshBox
        isRefreshing={refreshing}
        onRefresh={onRefresh}
        contentAlignment="topCenter"
        modifiers={[fillMaxSize(), background(colors.background)]}
      >
        <Column
          verticalArrangement={{ spacedBy: 20 }}
          modifiers={[
            fillMaxSize(),
            verticalScroll(),
            imePadding(),
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
                Changelog
              </Text>
              <Text
                style={{ typography: "bodySmall" }}
                color={colors.onSurfaceVariant}
              >
                Tambah pembaruan aplikasi
              </Text>
            </Column>
          </Row>

          <Column verticalArrangement={{ spacedBy: 12 }}>
            <OutlinedTextField
              ref={titleRef}
              singleLine
              onValueChange={setTitle}
              keyboardOptions={{ capitalization: "sentences" }}
              modifiers={[fillMaxWidth()]}
            >
              <OutlinedTextField.Label>
                <Text>Judul</Text>
              </OutlinedTextField.Label>
            </OutlinedTextField>

            <OutlinedTextField
              ref={descRef}
              onValueChange={setDescription}
              minLines={3}
              keyboardOptions={{ capitalization: "sentences" }}
              modifiers={[fillMaxWidth()]}
            >
              <OutlinedTextField.Label>
                <Text>Deskripsi (opsional)</Text>
              </OutlinedTextField.Label>
            </OutlinedTextField>

            <Button
              enabled={title.trim().length > 0 && !submitting}
              onClick={handleSubmit}
              modifiers={[fillMaxWidth()]}
            >
              <ButtonContent
                loading={submitting}
                enabled={title.trim().length > 0}
                label="Tambah & notif semua"
                color={colors.onPrimary}
              />
            </Button>
          </Column>

          <Text
            style={{ typography: "labelLarge", fontWeight: "bold" }}
            color={colors.onSurfaceVariant}
          >
            {`${entries.length} pembaruan`}
          </Text>

          {entries.length === 0 && (
            <Text
              style={{ typography: "bodyMedium" }}
              color={colors.onSurfaceVariant}
            >
              Belum ada pembaruan.
            </Text>
          )}

          <Column>
            {entries.map((entry, i) => (
              <Column key={entry.id}>
                <Column
                  verticalArrangement={{ spacedBy: 4 }}
                  modifiers={[padding(0, 14, 0, 14)]}
                >
                  <Text
                    style={{ typography: "labelSmall", fontWeight: "bold" }}
                    color={colors.primary}
                  >
                    {formatDate(entry.created_at)}
                  </Text>
                  <Text
                    style={{ typography: "bodyLarge", fontWeight: "600" }}
                    color={colors.onSurface}
                  >
                    {entry.title}
                  </Text>
                  {entry.description && (
                    <Text
                      style={{ typography: "bodyMedium" }}
                      color={colors.onSurfaceVariant}
                    >
                      {entry.description}
                    </Text>
                  )}
                </Column>
                {i < entries.length - 1 && (
                  <HorizontalDivider color={colors.outlineVariant} />
                )}
              </Column>
            ))}
          </Column>
        </Column>
      </PullToRefreshBox>
    </Host>
  );
}
