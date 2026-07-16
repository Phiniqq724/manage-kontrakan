import { changelogsApi } from "@/services/api";
import type { Database } from "@/utils/supabase-types";
import ArrowBack from "@expo/material-symbols/arrow_back.xml";
import { Host } from "@expo/ui";
import {
  Column,
  HorizontalDivider,
  Icon,
  IconButton,
  PullToRefreshBox,
  Row,
  Text,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  background,
  fillMaxSize,
  fillMaxWidth,
  padding,
  verticalScroll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { router } from "expo-router";
import { useEffect, useState } from "react";

type ChangelogRow = Database["public"]["Tables"]["changelogs"]["Row"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function ChangelogScreen() {
  const colors = useMaterialColors();
  const [entries, setEntries] = useState<ChangelogRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

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
          <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 4 }} modifiers={[fillMaxWidth()]}>
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
                Riwayat pembaruan aplikasi
              </Text>
            </Column>
          </Row>

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
